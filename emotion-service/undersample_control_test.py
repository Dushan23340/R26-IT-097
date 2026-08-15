"""Root-cause diagnostic ONLY - throwaway, does not touch production.

Question: is Frustrated's low F1 (0.50) explained by its small sample count
alone (quantity), or is there something inherently harder about it beyond
count (quality/ambiguity)?

Test: artificially shrink Bored's TRAIN split down to Frustrated's actual
train count (2,801, from today's real-data-recovered dataset), train a
model identical in architecture/procedure to train_fused_model_v3.py
(frozen-base stage only - this is a quick control, not a real candidate
model), and see what F1 a class with EQUAL sample count gets when it's a
class the model otherwise finds easy (Bored, normally 0.90 F1).

  - If shrunk-Bored's F1 drops to ~Frustrated's actual 0.50 -> count alone
    explains most of the gap (quantity is the dominant factor).
  - If shrunk-Bored still scores well above 0.50 despite equal sample count
    -> Frustrated has a real, additional inherent-difficulty component
    beyond just having fewer examples (quality/ambiguity matters too).

No oversampling here (that's a separate, deliberate confound to avoid -
this test isolates raw sample COUNT only). Val split is the real, full,
untouched validation set - same one every other evaluation this session
used, so the resulting F1 numbers are directly comparable.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import tensorflow as tf
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from tensorflow.keras.callbacks import EarlyStopping
from tensorflow.keras.layers import Concatenate, Dense, Dropout, GlobalAveragePooling2D, Input
from tensorflow.keras.models import Model
from tensorflow.keras.optimizers import Adam

SERVICE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SERVICE_DIR / "src"))
from emotion_service.ml.occlusion import (  # noqa: E402
    _BAND_SIGMA, _EYE_BAND_CENTER, _MOUTH_BAND_CENTER, _WEIGHT_FLOOR, _WEIGHT_PEAK,
)

FEATURES_PATH = "dataset/facial_features_v3.npz"
IMG_SIZE = 224
BATCH_SIZE = 32
EPOCHS = 8
VAL_SPLIT = 0.2
SEED = 42

data = np.load(FEATURES_PATH, allow_pickle=True)
paths = data["paths"]
labels = data["labels"]
features = data["features"].astype("float32")

classes = sorted(set(labels.tolist()))
class_to_index = {name: i for i, name in enumerate(classes)}
label_indices = np.array([class_to_index[l] for l in labels], dtype="int64")

train_idx, val_idx = train_test_split(
    np.arange(len(paths)), test_size=VAL_SPLIT, random_state=SEED, stratify=label_indices
)

bored_idx = class_to_index["Bored"]
frustrated_idx = class_to_index["Frustrated"]

train_labels = label_indices[train_idx]
frustrated_train_count = int((train_labels == frustrated_idx).sum())
bored_train_idx = train_idx[train_labels == bored_idx]
other_train_idx = train_idx[train_labels != bored_idx]

print(f"Frustrated actual train count: {frustrated_train_count}")
print(f"Bored actual train count: {len(bored_train_idx)}")

rng = np.random.RandomState(SEED)
bored_subsampled_idx = rng.choice(bored_train_idx, size=frustrated_train_count, replace=False)

new_train_idx = np.concatenate([other_train_idx, bored_subsampled_idx])
rng.shuffle(new_train_idx)

print(f"New (Bored-subsampled) train count: {len(new_train_idx)} "
      f"(was {len(train_idx)}, Bored now {frustrated_train_count} instead of {len(bored_train_idx)})")


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


def _load_image(path: tf.Tensor) -> tf.Tensor:
    raw = tf.io.read_file(path)
    image = tf.io.decode_image(raw, channels=3, expand_animations=False)
    return tf.image.resize(image, (IMG_SIZE, IMG_SIZE))


def _augment(image: tf.Tensor) -> tf.Tensor:
    image = tf.image.random_flip_left_right(image)
    image = tf.image.random_brightness(image, max_delta=0.15)
    image = tf.image.random_contrast(image, lower=0.85, upper=1.15)
    return tf.clip_by_value(image, 0.0, 255.0)


def make_dataset(indices: np.ndarray, training: bool) -> tf.data.Dataset:
    subset_paths = paths[indices]
    subset_features = features[indices]
    subset_labels = tf.one_hot(label_indices[indices], depth=len(classes))

    ds = tf.data.Dataset.from_tensor_slices((subset_paths, subset_features, subset_labels))

    def _map(path, feature_vec, label):
        image = _load_image(path)
        if training:
            image = _augment(image)
        image = _apply_region_weighting(image)
        image = preprocess_input(image)
        return (image, feature_vec), label

    ds = ds.map(_map, num_parallel_calls=tf.data.AUTOTUNE)
    if training:
        ds = ds.shuffle(2048, seed=SEED)
    ds = ds.batch(BATCH_SIZE).prefetch(tf.data.AUTOTUNE)
    return ds


train_ds = make_dataset(new_train_idx, training=True)
val_ds = make_dataset(val_idx, training=False)

image_input = Input(shape=(IMG_SIZE, IMG_SIZE, 3), name="image_input")
feature_input = Input(shape=(features.shape[1],), name="feature_input")

base_model = MobileNetV2(weights="imagenet", include_top=False, input_tensor=image_input)
base_model.trainable = False

x = base_model.output
x = GlobalAveragePooling2D()(x)
x = Dense(256, activation="relu")(x)
x = Dropout(0.5)(x)

f = Dense(64, activation="relu")(feature_input)
f = Dropout(0.3)(f)
f = Dense(32, activation="relu")(f)

fused = Concatenate()([x, f])
fused = Dense(128, activation="relu")(fused)
fused = Dropout(0.4)(fused)
predictions = Dense(len(classes), activation="softmax")(fused)

model = Model(inputs=[image_input, feature_input], outputs=predictions)
model.compile(optimizer=Adam(learning_rate=0.001), loss="categorical_crossentropy", metrics=["accuracy"])

early_stop = EarlyStopping(monitor="val_accuracy", patience=3, mode="max", restore_best_weights=True)

print("\nTraining (frozen-base only, quick control run, NOT a production candidate)...")
model.fit(train_ds, validation_data=val_ds, epochs=EPOCHS, callbacks=[early_stop])

print("\nEvaluating on the REAL, FULL, untouched validation set...")
predictions_val = model.predict(val_ds, verbose=0)
y_pred = np.argmax(predictions_val, axis=1)
y_true = label_indices[val_idx]

report = classification_report(y_true, y_pred, target_names=classes, output_dict=True)
print(classification_report(y_true, y_pred, target_names=classes))

print("\n" + "=" * 60)
print("CONTROL TEST RESULT")
print("=" * 60)
bored_f1 = report["Bored"]["f1-score"]
print(f"Bored F1 with only {frustrated_train_count} train samples (same count as Frustrated): {bored_f1:.3f}")
print("Compare to:")
print("  Bored's normal F1 (full ~17,894 samples, from evaluate_fused_model_v3.py): 0.90")
print("  Frustrated's actual F1 (2,801 samples, from evaluate_fused_model_v3.py):    0.50")
if bored_f1 <= 0.55:
    print("\n-> Bored dropped to roughly Frustrated's level: QUANTITY explains most of the gap.")
elif bored_f1 >= 0.75:
    print("\n-> Bored stayed well above Frustrated's level despite equal sample count:")
    print("   Frustrated has a real INHERENT difficulty beyond just sample count (quality/ambiguity matters).")
else:
    print("\n-> Bored landed between the two extremes: BOTH quantity and inherent difficulty likely contribute.")
