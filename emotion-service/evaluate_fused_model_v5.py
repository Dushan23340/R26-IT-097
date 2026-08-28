"""Evaluates model/best_fused_model_v5 - the never-promoted retrain that
added 1,721 real, recovered DAiSEE Frustrated crops (1,780 -> 3,501) on top
of v4's oversampling. Trained and saved (Aug 13), but its own docstring
says the confirmatory step - "confirming this one is better via the
confusion-matrix validation against the live pipeline" - was never actually
run before v3 stayed in production. This is that missing step, otherwise
identical in methodology to evaluate_fused_model_v3.py (same dataset file,
same split/seed, same clean-vs-occluded comparison) so its numbers are
directly comparable to what that script already reported for v3 today.
"""

import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from tensorflow.keras.models import load_model
import tensorflow as tf
import sys
from pathlib import Path

SERVICE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SERVICE_DIR / "src"))
from emotion_service.ml.occlusion import (
    _BAND_SIGMA,
    _EYE_BAND_CENTER,
    _MOUTH_BAND_CENTER,
    _WEIGHT_FLOOR,
    _WEIGHT_PEAK,
)

FEATURES_PATH = "dataset/facial_features_v3.npz"
IMG_SIZE = 224
BATCH_SIZE = 32
VAL_SPLIT = 0.2
SEED = 42
OCCLUSION_FRAC = 0.30

data = np.load(FEATURES_PATH, allow_pickle=True)
paths = data["paths"]
labels = data["labels"]
features = data["features"].astype("float32")

classes = sorted(set(labels.tolist()))
class_to_index = {name: i for i, name in enumerate(classes)}
label_indices = np.array([class_to_index[label] for label in labels], dtype="int64")

_, val_idx = train_test_split(
    np.arange(len(paths)), test_size=VAL_SPLIT, random_state=SEED, stratify=label_indices
)

val_paths = paths[val_idx]
val_features = features[val_idx]
val_labels = label_indices[val_idx]


def _build_region_weight_mask() -> tf.Tensor:
    y = tf.linspace(0.0, 1.0, IMG_SIZE)
    eye_band = tf.exp(-tf.square(y - _EYE_BAND_CENTER) / (2 * _BAND_SIGMA ** 2))
    mouth_band = tf.exp(-tf.square(y - _MOUTH_BAND_CENTER) / (2 * _BAND_SIGMA ** 2))
    row_weight = tf.maximum(eye_band, mouth_band)
    weight = _WEIGHT_FLOOR + (_WEIGHT_PEAK - _WEIGHT_FLOOR) * row_weight
    weight = tf.reshape(weight, (IMG_SIZE, 1, 1))
    return tf.tile(weight, (1, IMG_SIZE, 1))


_REGION_WEIGHT_MASK = _build_region_weight_mask()


def _apply_region_weighting(image: tf.Tensor) -> tf.Tensor:
    mean_color = tf.reduce_mean(image, axis=[0, 1], keepdims=True)
    return image * _REGION_WEIGHT_MASK + mean_color * (1.0 - _REGION_WEIGHT_MASK)


def _apply_fixed_occlusion(image: tf.Tensor) -> tf.Tensor:
    cut = int(IMG_SIZE * OCCLUSION_FRAC)
    start = (IMG_SIZE - cut) // 2
    mean_color = tf.reduce_mean(image, axis=[0, 1], keepdims=True)
    hole = tf.zeros((cut, cut, 1), dtype=tf.float32)
    keep_mask = tf.pad(
        hole,
        [[start, IMG_SIZE - start - cut], [start, IMG_SIZE - start - cut], [0, 0]],
        constant_values=1.0,
    )
    return image * keep_mask + mean_color * (1.0 - keep_mask)


def _load_image(path):
    raw = tf.io.read_file(path)
    image = tf.io.decode_image(raw, channels=3, expand_animations=False)
    image = tf.image.resize(image, (IMG_SIZE, IMG_SIZE))
    return image


def _make_val_ds(occluded: bool):
    def _map(path, feature_vec, label):
        image = _load_image(path)
        if occluded:
            image = _apply_fixed_occlusion(image)
        image = _apply_region_weighting(image)
        image = preprocess_input(image)
        return (image, feature_vec), label

    return (
        tf.data.Dataset.from_tensor_slices((val_paths, val_features, val_labels))
        .map(_map, num_parallel_calls=tf.data.AUTOTUNE)
        .batch(BATCH_SIZE)
        .prefetch(tf.data.AUTOTUNE)
    )


print("Loading model/best_fused_model_v5.keras")
model = load_model("model/best_fused_model_v5.keras")
y_true = val_labels

for label, occluded in (("CLEAN", False), ("SYNTHETICALLY OCCLUDED (30% center blank)", True)):
    print(f"\n{'=' * 60}\n{label}\n{'=' * 60}")
    val_ds = _make_val_ds(occluded=occluded)
    predictions = model.predict(val_ds, verbose=1)
    y_pred = np.argmax(predictions, axis=1)
    print(classification_report(y_true, y_pred, target_names=classes))

    if not occluded:
        cm = confusion_matrix(y_true, y_pred)
        plt.figure(figsize=(8, 8))
        sns.heatmap(cm, annot=True, fmt="d", xticklabels=classes, yticklabels=classes)
        plt.xlabel("Predicted")
        plt.ylabel("Actual")
        plt.tight_layout()
        plt.savefig("model/fused_confusion_matrix_v5.png")
        print("Saved confusion matrix to model/fused_confusion_matrix_v5.png")
