"""Train a facial-expression model that fuses two input branches:

- Image branch: the face crop through MobileNetV2 (same as train_mobilenetv2.py)
- Feature branch: 56-dim MediaPipe blendshape/head-pose vector produced by
  scripts/extract_facial_features.py (52 blendshapes incl. eyeBlinkLeft/
  Right, brow/mouth/jaw shape, 3 head-pose angles, 1 detected flag)

Same 3-class target (Angry/Happy/Normal) as the Phase 2 model - this adds
richer input signal, it doesn't add new output classes, so no new ground
truth labeling was needed.

Run scripts/extract_facial_features.py first to produce
dataset/facial_features.npz.
"""

from __future__ import annotations

import json
import os

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

FEATURES_PATH = "dataset/facial_features.npz"
IMG_SIZE = 224
BATCH_SIZE = 32
HEAD_EPOCHS = 8
FINE_TUNE_EPOCHS = 12
VAL_SPLIT = 0.2
SEED = 42

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
# tf.data PIPELINE (image + feature -> label)
# =====================================

def _load_image(path: tf.Tensor) -> tf.Tensor:
    raw = tf.io.read_file(path)
    image = tf.io.decode_jpeg(raw, channels=3)
    image = tf.image.resize(image, (IMG_SIZE, IMG_SIZE))
    return image


def _augment(image: tf.Tensor) -> tf.Tensor:
    image = tf.image.random_flip_left_right(image)
    image = tf.image.random_brightness(image, max_delta=0.15)
    image = tf.image.random_contrast(image, lower=0.85, upper=1.15)
    image = tf.clip_by_value(image, 0.0, 255.0)
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
    "model/best_fused_model.keras", monitor="val_accuracy", save_best_only=True, mode="max", verbose=1
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

model.save("model/fused_model_final.keras")
model.save("model/best_fused_model.h5")

with open("model/fused_class_indices.json", "w", encoding="utf-8") as f:
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
plt.title("Fused Model Training Accuracy")
plt.legend()
plt.savefig("model/fused_training_accuracy.png")

plt.figure(figsize=(10, 5))
plt.plot(loss, label="Training Loss")
plt.plot(val_loss, label="Validation Loss")
plt.xlabel("Epoch")
plt.ylabel("Loss")
plt.title("Fused Model Training Loss")
plt.legend()
plt.savefig("model/fused_training_loss.png")

print("Training graphs saved!")
print("Best model saved as: model/best_fused_model.keras / model/best_fused_model.h5")
