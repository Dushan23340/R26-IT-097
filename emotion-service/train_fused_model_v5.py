"""v5 of train_fused_model.py - trains on the enlarged facial_features_v3.npz
after real DAiSEE data recovery, keeping v4's oversampling on top.

v4 (oversampling alone, no new data) was a lateral trade-off: Frustrated
44.8%->55.2% but Confused paid for it, 77.6%->70.7%, macro accuracy barely
moved. Root cause wasn't fixable by reweighting/repeating the same 1,780
Frustrated images - it needed more of them. extract_daisee_frustration_v2.py
recovered 1,721 additional real, clean Frustrated face crops from DAiSEE
that the original extraction discarded for two reasons: (1) it only ever
read TrainLabels.csv, never Validation/Test; (2) its label rule was a
strict single-winner argmax across Boredom/Confusion/Frustration/
Engagement, which discards a clip like Frustration=2/Engagement=3 into
"engagement" (not even one of this project's 6 classes) even though it's a
real, visibly frustrated clip. final_dataset/Frustrated grew 1,780 -> 3,501
(all real DAiSEE frames, zero synthetic data, all passed the same corrupt/
blank/duplicate filtering as every other class-build script in this repo).

facial_features_v3.npz was regenerated (scripts/extract_facial_features_v3.py)
over the enlarged final_dataset before this script runs. Frustrated's train-
split oversampling multiplier is now ~1.9x (was 3.0x in v4) since the real
count is so much closer to parity - Bored:Frustrated is now ~6.4:1, was
12.5:1.

Same architecture/procedure/augmentation/occlusion-handling/oversampling-
rule as train_fused_model_v4.py (kept unmodified for a clean before/after
comparison) - only the underlying data and output filenames change. The
current production model (model/best_fused_model.h5) is never overwritten
by this script; swap it in manually only after confirming this one is
better via the confusion-matrix validation against the live pipeline.
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

# Oversampling knobs - see module docstring.
OVERSAMPLE_TARGET_FRACTION = 0.30
OVERSAMPLE_MAX_MULTIPLIER = 3

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
print(f"Train (pre-oversample): {len(train_idx)}  Val: {len(val_idx)}")

# =====================================
# MINORITY-CLASS OVERSAMPLING (train split only - val stays untouched so
# accuracy numbers reported against it remain an honest, natural-distribution
# readout)
# =====================================

rng = np.random.default_rng(SEED)
train_labels = label_indices[train_idx]
majority_count = max(np.bincount(train_labels))
target_count = int(majority_count * OVERSAMPLE_TARGET_FRACTION)

oversampled_idx = [train_idx]
for class_idx in range(len(classes)):
    class_mask = train_labels == class_idx
    class_train_idx = train_idx[class_mask]
    current_count = len(class_train_idx)
    if current_count == 0 or current_count >= target_count:
        continue

    capped_target = min(target_count, current_count * OVERSAMPLE_MAX_MULTIPLIER)
    extra_needed = capped_target - current_count
    if extra_needed <= 0:
        continue

    extra = rng.choice(class_train_idx, size=extra_needed, replace=True)
    oversampled_idx.append(extra)
    print(
        f"  oversampling {classes[class_idx]}: {current_count} -> {capped_target} "
        f"({capped_target / current_count:.2f}x)"
    )

train_idx = np.concatenate(oversampled_idx)
rng.shuffle(train_idx)

print(f"Train (post-oversample): {len(train_idx)}  Val: {len(val_idx)}")

weights = compute_class_weight(
    class_weight="balanced",
    classes=np.unique(label_indices[train_idx]),
    y=label_indices[train_idx],
)
class_weights = dict(enumerate(weights))
print(f"Class weights (post-oversample, should be milder than v3's): {class_weights}")


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
    "model/best_fused_model_v5.keras", monitor="val_accuracy", save_best_only=True, mode="max", verbose=1
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

model.save("model/fused_model_v5_final.keras")
model.save("model/best_fused_model_v5.h5")

with open("model/fused_class_indices_v5.json", "w", encoding="utf-8") as f:
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
plt.title("Fused Model Training Accuracy (v5: 6-class + occlusion handling + oversampling + real DAiSEE Frustration data recovery)")
plt.legend()
plt.savefig("model/fused_training_accuracy_v5.png")

plt.figure(figsize=(10, 5))
plt.plot(loss, label="Training Loss")
plt.plot(val_loss, label="Validation Loss")
plt.xlabel("Epoch")
plt.ylabel("Loss")
plt.title("Fused Model Training Loss (v5: 6-class + occlusion handling + oversampling + real DAiSEE Frustration data recovery)")
plt.legend()
plt.savefig("model/fused_training_loss_v5.png")

print("Training graphs saved!")
print("Best model saved as: model/best_fused_model_v5.keras / model/best_fused_model_v5.h5")
