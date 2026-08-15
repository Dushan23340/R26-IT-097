"""Baseline occlusion comparison - the missing half of evaluate_fused_model_v2.py.

train_fused_model_v2.py has NO occlusion-handling mechanisms (confirmed:
no Cutout augmentation, no facial region weighting - grep for
"cutout"/"region_weight" in that file returns nothing). It is the genuine
baseline CNN model this project's occlusion-handling objective needs to be
compared against - v3 (train_fused_model_v3.py) adds both mechanisms on
top of the same base architecture/procedure.

Runs v2 through the EXACT SAME clean-vs-synthetically-occluded methodology
as evaluate_fused_model_v3.py (fixed 30%-of-crop center blank, applied
deterministically), on v2's own held-out split, so the resulting accuracy
DROP (clean -> occluded) is directly, fairly comparable to v3's already-
measured drop - this is the number the "improve accuracy under occlusion
vs baseline CNN" objective is actually asking for, and it did not exist
anywhere in the repo before this script.
"""

import numpy as np
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from tensorflow.keras.models import load_model
import tensorflow as tf

FEATURES_PATH = "dataset/facial_features_v2.npz"
IMG_SIZE = 224
BATCH_SIZE = 32
VAL_SPLIT = 0.2
SEED = 42
OCCLUSION_FRAC = 0.30  # same as evaluate_fused_model_v3.py, for a fair comparison

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
    return tf.image.resize(image, (IMG_SIZE, IMG_SIZE))


def _make_val_ds(occluded: bool):
    def _map(path, feature_vec, label):
        image = _load_image(path)
        if occluded:
            image = _apply_fixed_occlusion(image)
        # No region weighting here - v2 was never trained with it, so
        # applying it at eval time would be an inference/train mismatch,
        # not a real test of v2's own behavior.
        image = preprocess_input(image)
        return (image, feature_vec), label

    return (
        tf.data.Dataset.from_tensor_slices((val_paths, val_features, val_labels))
        .map(_map, num_parallel_calls=tf.data.AUTOTUNE)
        .batch(BATCH_SIZE)
        .prefetch(tf.data.AUTOTUNE)
    )


print("Loading model/best_fused_model_v2.keras (baseline - no occlusion handling)")
model = load_model("model/best_fused_model_v2.keras")
y_true = val_labels

for label, occluded in (("CLEAN", False), ("SYNTHETICALLY OCCLUDED (30% center blank)", True)):
    print(f"\n{'=' * 60}\n{label}\n{'=' * 60}")
    val_ds = _make_val_ds(occluded=occluded)
    predictions = model.predict(val_ds, verbose=0)
    y_pred = np.argmax(predictions, axis=1)
    print(classification_report(y_true, y_pred, target_names=classes))
