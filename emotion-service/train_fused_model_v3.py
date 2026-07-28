"""v3 of train_fused_model.py - two changes over v2:

1. Trains on dataset/final_dataset (the real 6-class set: Happy/Frustrated/
   Bored/Angry/Normal/Confused) instead of expression_dataset_v2's 3 classes
   (Angry/Happy/Normal) - v2, and the currently-served best_fused_model.h5,
   only ever learned 3 of the 6 emotions the rest of the platform expects.
2. Adds the two occlusion-handling mechanisms from the proposal (section
   3.2) that were previously undocumented anywhere in code:
     - Synthetic occlusion augmentation (Cutout/Random Erasing): randomly
       blanks a rectangular region of the training image to the image's
       own mean color, so the model learns to still classify correctly
       when part of the face is genuinely occluded (hand, object, glasses
       glare, etc).
     - Facial region weighting: a fixed eye/mouth emphasis mask (see
       src/emotion_service/ml/occlusion.py for the shared formula and full
       rationale) applied to every image, train and val alike - and
       applied identically at inference time in fused_emotion_model.py,
       so there's no train/inference distribution mismatch.

Same architecture/procedure as train_fused_model.py and train_fused_model_v2.py
(both kept unmodified for a clean before/after comparison) - only the
features file, augmentation, and output filenames change. The current
production model (model/best_fused_model.h5) is never overwritten by this
script; swap it in manually only after evaluate_fused_model_v3.py confirms
this one is trained and correct.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.utils.class_weight import compute_class_weight
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
from tensorflow.keras.layers import (
    Concatenate,
    Dense,
    Dropout,
    GlobalAveragePooling2D,
    Input,
)
from tensorflow.keras.models import Model
from tensorflow.keras.optimizers import Adam

SERVICE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SERVICE_DIR / "src"))
from emotion_service.ml.occlusion import (  # noqa: E402
    _BAND_SIGMA,
    _EYE_BAND_CENTER,
    _MOUTH_BAND_CENTER,
    _WEIGHT_FLOOR,
    _WEIGHT_PEAK,
)

FEATURES_PATH = "dataset/facial_features_v3.npz"
IMG_SIZE = 224
BATCH_SIZE = 32
HEAD_EPOCHS = 8
FINE_TUNE_EPOCHS = 12
VAL_SPLIT = 0.2
SEED = 42
CUTOUT_PROB = 0.5
CUTOUT_MIN_FRAC = 0.10
CUTOUT_MAX_FRAC = 0.35

os.makedirs("model", exist_ok=True)

# =====================================
# LOAD CACHED FEATURES + BUILD SPLIT
# =====================================

data = np.load(FEATURES_PATH, allow_pickle=True)
paths = data["paths"]
labels = data["labels"]
features = data["features"].astype("float32")

classes = sorted(set(labels.tolist()))
class_to_index = {name: i for i, name in enumerate(classes)}
label_indices = np.array([class_to_index[label] for label in labels], dtype="int64")

train_idx, val_idx = train_test_split(
    np.arange(len(paths)),
    test_size=VAL_SPLIT,
    random_state=SEED,
    stratify=label_indices,
)

print(f"Classes: {class_to_index}")
print(f"Train: {len(train_idx)}  Val: {len(val_idx)}")

weights = compute_class_weight(
    class_weight="balanced",
    classes=np.unique(label_indices[train_idx]),
    y=label_indices[train_idx],
)
class_weights = dict(enumerate(weights))
print(f"Class weights: {class_weights}")


# =====================================
# OCCLUSION HANDLING (1/2): synthetic Cutout augmentation
# =====================================

def _random_cutout(image: tf.Tensor) -> tf.Tensor:
    """Blanks a random square region (10-35% of the crop's side) to the
    image's own mean color, applied to ~50% of training samples. Operates
    on [0, 255]-range images, before preprocess_input."""

    def _apply() -> tf.Tensor:
        frac = tf.random.uniform([], CUTOUT_MIN_FRAC, CUTOUT_MAX_FRAC)
        cut_size = tf.maximum(tf.cast(tf.cast(IMG_SIZE, tf.float32) * frac, tf.int32), 1)
        y0 = tf.random.uniform([], 0, IMG_SIZE - cut_size, dtype=tf.int32)
        x0 = tf.random.uniform([], 0, IMG_SIZE - cut_size, dtype=tf.int32)

        mean_color = tf.reduce_mean(image, axis=[0, 1], keepdims=True)
        hole = tf.zeros((cut_size, cut_size, 1), dtype=tf.float32)
        keep_mask = tf.pad(
            hole,
            [[y0, IMG_SIZE - y0 - cut_size], [x0, IMG_SIZE - x0 - cut_size], [0, 0]],
            constant_values=1.0,
        )
        return image * keep_mask + mean_color * (1.0 - keep_mask)

    return tf.cond(tf.random.uniform([]) < CUTOUT_PROB, _apply, lambda: image)


# =====================================
# OCCLUSION HANDLING (2/2): facial region weighting
# Same formula/constants as src/emotion_service/ml/occlusion.py - shared
# there for inference; re-implemented here as native TF ops (rather than a
# slow per-sample tf.numpy_function call) for training throughput. Applied
# to every image (train AND val), not just augmented training samples, so
# it matches what the model always sees at inference time.
# =====================================

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


# =====================================
# tf.data PIPELINE (image + feature -> label)
# =====================================

def _load_image(path: tf.Tensor) -> tf.Tensor:
    raw = tf.io.read_file(path)
    image = tf.io.decode_image(raw, channels=3, expand_animations=False)
    image = tf.image.resize(image, (IMG_SIZE, IMG_SIZE))
    return image


def _augment(image: tf.Tensor) -> tf.Tensor:
    image = tf.image.random_flip_left_right(image)
    image = tf.image.random_brightness(image, max_delta=0.15)
    image = tf.image.random_contrast(image, lower=0.85, upper=1.15)
    image = tf.clip_by_value(image, 0.0, 255.0)
    image = _random_cutout(image)
    return image


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


train_ds = make_dataset(train_idx, training=True)
val_ds = make_dataset(val_idx, training=False)

# =====================================
# MODEL: two branches -> fusion head
# =====================================

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

checkpoint = ModelCheckpoint(
    "model/best_fused_model_v3.keras", monitor="val_accuracy", save_best_only=True, mode="max", verbose=1
)
early_stop = EarlyStopping(monitor="val_accuracy", patience=5, mode="max", restore_best_weights=True)
reduce_lr = ReduceLROnPlateau(monitor="val_loss", factor=0.2, patience=3, verbose=1, min_lr=1e-6)
callbacks = [checkpoint, early_stop, reduce_lr]

print("\n========== Stage 1 ==========")
print("Training classifier + feature head...")
history1 = model.fit(train_ds, validation_data=val_ds, epochs=HEAD_EPOCHS, class_weight=class_weights, callbacks=callbacks)

print("\n========== Stage 2 ==========")
print("Fine tuning last MobileNetV2 layers...")
base_model.trainable = True
for layer in base_model.layers[:-30]:
    layer.trainable = False

model.compile(optimizer=Adam(learning_rate=1e-4), loss="categorical_crossentropy", metrics=["accuracy"])
history2 = model.fit(train_ds, validation_data=val_ds, epochs=FINE_TUNE_EPOCHS, class_weight=class_weights, callbacks=callbacks)

model.save("model/fused_model_v3_final.keras")
model.save("model/best_fused_model_v3.h5")

with open("model/fused_class_indices_v3.json", "w", encoding="utf-8") as f:
    json.dump({str(v): k for k, v in class_to_index.items()}, f, indent=2)

print("\nFinal fused model saved!")

accuracy = history1.history["accuracy"] + history2.history["accuracy"]
val_accuracy = history1.history["val_accuracy"] + history2.history["val_accuracy"]
loss = history1.history["loss"] + history2.history["loss"]
val_loss = history1.history["val_loss"] + history2.history["val_loss"]

plt.figure(figsize=(10, 5))
plt.plot(accuracy, label="Training Accuracy")
plt.plot(val_accuracy, label="Validation Accuracy")
plt.xlabel("Epoch")
plt.ylabel("Accuracy")
plt.title("Fused Model Training Accuracy (v3: 6-class + occlusion handling)")
plt.legend()
plt.savefig("model/fused_training_accuracy_v3.png")

plt.figure(figsize=(10, 5))
plt.plot(loss, label="Training Loss")
plt.plot(val_loss, label="Validation Loss")
plt.xlabel("Epoch")
plt.ylabel("Loss")
plt.title("Fused Model Training Loss (v3: 6-class + occlusion handling)")
plt.legend()
plt.savefig("model/fused_training_loss_v3.png")

print("Training graphs saved!")
print("Best model saved as: model/best_fused_model_v3.keras / model/best_fused_model_v3.h5")
