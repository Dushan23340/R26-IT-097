"""v4: replaces v3's pretrained-MobileNetV2 image branch with a genuine
custom lightweight CNN built from MobileNet-style depthwise separable
convolution blocks, trained from scratch (no ImageNet weights) - what the
proposal actually claims (abstract, 2.2, 3.2, Fig. 1/2): "a custom
convolutional neural network inspired by MobileNet-style depthwise
separable convolutions", not transfer learning on a pretrained backbone.

Also switches to the proposal's own stated 48x48 input size (3.2: "resizing
images to 48 x 48 pixels") instead of the 224x224 MobileNetV2/ImageNet
convention v1-v3 all inherited - a from-scratch model has no reason to keep
that size, and 48x48 is both what's literally specified and genuinely
lighter (fewer FLOPs, smaller/faster model), which is the whole point of
"lightweight" in the first place.

Keeps everything else from v3: the MediaPipe blendshape/head-pose fusion
branch (a legitimate enhancement beyond the proposal, not a contradiction
of it - reuses the same cached dataset/facial_features_v3.npz, since
blendshape extraction is independent of the image CNN's input size),
Cutout occlusion augmentation, and eye/mouth region-weighting.

This is NOT automatically swapped into production - train_fused_model_v3.py
(currently serving via model/best_fused_model.h5) gets a head start from
ImageNet pretraining that a from-scratch model can't match, so accuracy
here is expected to be lower. Evaluate with evaluate_custom_cnn_v4.py
against the same clean/occluded methodology as v3 before deciding whether
to swap, keep both, or keep v3 as the served model and this as the
proposal-faithful reference.
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
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
from tensorflow.keras.layers import (
    Activation,
    BatchNormalization,
    Concatenate,
    Conv2D,
    Dense,
    DepthwiseConv2D,
    Dropout,
    GlobalAveragePooling2D,
    Input,
    Rescaling,
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
IMG_SIZE = 48  # proposal 3.2: "resizing images to 48 x 48 pixels"
BATCH_SIZE = 64  # larger batch is affordable now - far smaller images, no frozen backbone
EPOCHS = 40  # from-scratch training needs more iterations than fine-tuning a pretrained head
VAL_SPLIT = 0.2
SEED = 42
CUTOUT_PROB = 0.5
CUTOUT_MIN_FRAC = 0.10
CUTOUT_MAX_FRAC = 0.35

os.makedirs("model", exist_ok=True)

# =====================================
# LOAD CACHED FEATURES + BUILD SPLIT (same MediaPipe cache as v3 - the
# blendshape/pose extraction never depended on the image CNN's input size)
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
# OCCLUSION HANDLING (1/2): synthetic Cutout augmentation - identical
# mechanism to v3's, parameterised by IMG_SIZE=48 here.
# =====================================

def _random_cutout(image: tf.Tensor) -> tf.Tensor:
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
# OCCLUSION HANDLING (2/2): facial region weighting - same formula as
# src/emotion_service/ml/occlusion.py, re-implemented as native TF ops for
# training throughput (see train_fused_model_v3.py for the same pattern).
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
        # No preprocess_input here (that's MobileNetV2/ImageNet-specific
        # normalisation) - a Rescaling(1/255) layer is built into the model
        # itself below instead, so raw [0, 255] floats flow through the
        # tf.data pipeline and inference only ever needs one preprocessing
        # convention embedded in the saved model.
        return (image, feature_vec), label

    ds = ds.map(_map, num_parallel_calls=tf.data.AUTOTUNE)
    if training:
        ds = ds.shuffle(2048, seed=SEED)
    ds = ds.batch(BATCH_SIZE).prefetch(tf.data.AUTOTUNE)
    return ds


train_ds = make_dataset(train_idx, training=True)
val_ds = make_dataset(val_idx, training=False)

# =====================================
# MODEL: custom MobileNet-style depthwise-separable CNN (image branch)
# fused with the MediaPipe blendshape/pose branch (unchanged from v3)
# =====================================


def _ds_block(x, filters: int, stride: int, name: str):
    """One MobileNet-style block: depthwise 3x3 conv (spatial filtering,
    one filter per input channel) -> BN -> ReLU6, then pointwise 1x1 conv
    (channel mixing) -> BN -> ReLU6. This is the actual depthwise-separable
    decomposition the proposal names - a single Conv2D(filters, 3x3) would
    NOT be this, regardless of parameter count."""
    x = DepthwiseConv2D(3, strides=stride, padding="same", use_bias=False, name=f"{name}_dw")(x)
    x = BatchNormalization(name=f"{name}_dw_bn")(x)
    x = Activation("relu6", name=f"{name}_dw_relu")(x)

    x = Conv2D(filters, 1, padding="same", use_bias=False, name=f"{name}_pw")(x)
    x = BatchNormalization(name=f"{name}_pw_bn")(x)
    x = Activation("relu6", name=f"{name}_pw_relu")(x)
    return x


image_input = Input(shape=(IMG_SIZE, IMG_SIZE, 3), name="image_input")
feature_input = Input(shape=(features.shape[1],), name="feature_input")

x = Rescaling(1.0 / 255.0, name="rescale")(image_input)
x = Conv2D(32, 3, strides=2, padding="same", use_bias=False, name="stem")(x)  # 48 -> 24
x = BatchNormalization(name="stem_bn")(x)
x = Activation("relu6", name="stem_relu")(x)

x = _ds_block(x, 64, stride=1, name="block1")    # 24x24
x = _ds_block(x, 128, stride=2, name="block2")   # 24 -> 12
x = _ds_block(x, 128, stride=1, name="block3")   # 12x12
x = _ds_block(x, 256, stride=2, name="block4")   # 12 -> 6
x = _ds_block(x, 256, stride=1, name="block5")   # 6x6

x = GlobalAveragePooling2D(name="image_gap")(x)
x = Dropout(0.3, name="image_dropout")(x)

f = Dense(64, activation="relu")(feature_input)
f = Dropout(0.3)(f)
f = Dense(32, activation="relu")(f)

fused = Concatenate()([x, f])
fused = Dense(128, activation="relu")(fused)
fused = Dropout(0.4)(fused)
predictions = Dense(len(classes), activation="softmax")(fused)

model = Model(inputs=[image_input, feature_input], outputs=predictions)
model.compile(optimizer=Adam(learning_rate=0.001), loss="categorical_crossentropy", metrics=["accuracy"])
model.summary()

image_branch_params = sum(
    tf.size(w).numpy() for layer in model.layers
    for w in layer.trainable_weights
    if layer.name.startswith(("stem", "block", "image"))
)
print(f"\nImage-branch trainable params: {image_branch_params:,} "
      "(compare to MobileNetV2's ~2.3M for the equivalent backbone alone)")

checkpoint = ModelCheckpoint(
    "model/best_custom_cnn_v4.keras", monitor="val_accuracy", save_best_only=True, mode="max", verbose=1
)
early_stop = EarlyStopping(monitor="val_accuracy", patience=8, mode="max", restore_best_weights=True)
reduce_lr = ReduceLROnPlateau(monitor="val_loss", factor=0.2, patience=4, verbose=1, min_lr=1e-6)
callbacks = [checkpoint, early_stop, reduce_lr]

print("\n========== Training from scratch (no pretrained weights) ==========")
history = model.fit(train_ds, validation_data=val_ds, epochs=EPOCHS, class_weight=class_weights, callbacks=callbacks)

model.save("model/custom_cnn_v4_final.keras")
model.save("model/best_custom_cnn_v4.h5")

with open("model/custom_cnn_class_indices_v4.json", "w", encoding="utf-8") as f:
    json.dump({str(v): k for k, v in class_to_index.items()}, f, indent=2)

print("\nFinal custom CNN model saved!")

plt.figure(figsize=(10, 5))
plt.plot(history.history["accuracy"], label="Training Accuracy")
plt.plot(history.history["val_accuracy"], label="Validation Accuracy")
plt.xlabel("Epoch")
plt.ylabel("Accuracy")
plt.title("Custom Depthwise-Separable CNN Training Accuracy (v4)")
plt.legend()
plt.savefig("model/custom_cnn_training_accuracy_v4.png")

plt.figure(figsize=(10, 5))
plt.plot(history.history["loss"], label="Training Loss")
plt.plot(history.history["val_loss"], label="Validation Loss")
plt.xlabel("Epoch")
plt.ylabel("Loss")
plt.title("Custom Depthwise-Separable CNN Training Loss (v4)")
plt.legend()
plt.savefig("model/custom_cnn_training_loss_v4.png")

print("Training graphs saved!")
print("Best model saved as: model/best_custom_cnn_v4.keras / model/best_custom_cnn_v4.h5")
