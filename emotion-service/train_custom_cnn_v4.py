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

PRODUCTION DECISION (final, after the tuning history below): v3
(train_fused_model_v3.py, serving via model/best_fused_model.h5) stays
the served model. Both models were evaluated on the identical seeded val
split via evaluate_fused_model_v3.py / evaluate_custom_cnn_v4.py - v3
wins every accuracy metric by a real margin (clean macro-F1 0.80 vs 0.73,
occluded 0.76 vs 0.70, Frustrated F1 0.66 vs 0.56 clean / 0.67 vs 0.50
occluded - v4's weakest class also degrades most under occlusion). v4 is
faster (~41 vs ~24 FPS in-process) and ~11x smaller, but v3 already
clears the proposal's >=15 FPS / <50ms targets with headroom, so that
advantage doesn't change the outcome. v4 is kept as the proposal-faithful
reference implementation (genuine custom depthwise-separable CNN, no
pretrained backbone, 48x48 per 3.2) - documented and evaluated, not
served.

CLASS-IMBALANCE TUNING HISTORY (4 controlled runs, kept for the record):
this dataset is ~50% Bored vs ~4% Frustrated. In order:
  1. class_weight="balanced" + monitor="val_accuracy" for checkpoint/
     early-stop selection - looked fine on paper but the checkpoint was
     silently picking whichever epoch had the highest raw accuracy on a
     similarly-imbalanced stratified val split, which rewards majority-
     class performance regardless of how the loss was actually weighted.
  2. Fixed by adding macro_f1 (mean of per-class F1) and monitoring that
     instead - a model that nails Bored/Happy but misses Frustrated now
     scores poorly, which is the point.
  3. Two seeded (see determinism block below), controlled runs comparing
     MINORITY_BOOST strengths (1.5/1.3 vs 1.1/1.05 on top of "balanced")
     showed a real but small precision/recall trade-off, not a clear win
     either way (macro-F1 0.73 vs 0.72) - 1.5/1.3 marginally best.
  4. A seeded focal-loss run (make_focal_loss, gamma=2.0) using the same
     boosted weights as alpha came out clearly worse (macro-F1 0.69,
     Bored->Frustrated errors nearly doubled) - likely double-correcting
     for imbalance on top of focal loss's own implicit rare-class
     upweighting. Kept in the file (LOSS_FN=focal) for the record/
     reproducibility, not used by default.
  Converged on: categorical_crossentropy + class_weight (balanced +
  MINORITY_BOOST 1.5/1.3), monitor="val_macro_f1". The remaining
  Bored<->Frustrated confusion looks like genuine feature-level ambiguity
  at 48x48 resolution rather than something a loss-function change can
  fix - the proposal's own temporal features (duration, transition rate,
  stability - see student_state.py) are the more promising direction for
  disambiguating it, downstream of this CNN's scope.
"""

from __future__ import annotations

import json
import os
import random
import sys
from pathlib import Path

# Must be set before `import tensorflow` - TF reads TF_DETERMINISTIC_OPS at
# import/init time to decide whether to register deterministic GPU/CPU
# kernel variants, so setting it any later (e.g. next to the other seeding
# calls below) is too late to take effect. See SEED below for why this
# determinism matters: comparing MINORITY_BOOST values across separate
# runs was confounded by uncontrolled Cutout/Dropout/shuffle randomness.
SEED = 42
os.environ["PYTHONHASHSEED"] = str(SEED)
os.environ["TF_DETERMINISTIC_OPS"] = "1"

import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
import tensorflow as tf
from sklearn.metrics import classification_report, confusion_matrix
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
CUTOUT_PROB = 0.5
CUTOUT_MIN_FRAC = 0.10
CUTOUT_MAX_FRAC = 0.35

# Determinism (cont. from the PYTHONHASHSEED/TF_DETERMINISTIC_OPS env vars
# set before the TensorFlow import above): train_test_split's
# random_state=SEED already makes the train/val split itself reproducible,
# but everything downstream (Cutout's tf.random ops, Dropout, tf.data's
# shuffle) was still uncontrolled - two runs with identical hyperparameters
# could diverge from randomness alone, which is exactly what confounded
# comparing MINORITY_BOOST values across separate runs.
random.seed(SEED)
np.random.seed(SEED)
tf.random.set_seed(SEED)

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

# "balanced" is inverse-frequency (n / (k * count)) - Bored alone is ~50%
# of this dataset, Frustrated ~4%, a ~12.5x imbalance. Two seeded,
# controlled runs (1.5/1.3 vs 1.1/1.05) confirmed this is a real but small
# precision/recall trade-off, not a clear win either way (macro-F1 0.73 vs
# 0.72) - 1.5/1.3 is the (marginal) winner and is the base this focal loss
# experiment builds on. Overridable via env vars so other values can still
# be tried under the same fixed seed without editing this file.
MINORITY_BOOST = {
    "Frustrated": float(os.environ.get("FRUSTRATED_BOOST", 1.5)),
    "Angry": float(os.environ.get("ANGRY_BOOST", 1.3)),
}
for class_name, boost in MINORITY_BOOST.items():
    idx = class_to_index[class_name]
    class_weights[idx] *= boost
print(f"MINORITY_BOOST: {MINORITY_BOOST}")

# Appended to every output filename so two runs (e.g. comparing
# MINORITY_BOOST values) don't clobber each other's model/plots/report.
RUN_TAG = os.environ.get("RUN_TAG", "")

print(f"Class weights (after minority boost): {class_weights}")


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


def macro_f1(y_true: tf.Tensor, y_pred: tf.Tensor) -> tf.Tensor:
    """Unweighted mean of per-class F1 - unlike accuracy, a model that nails
    Bored/Happy (the majority classes) but misses every Frustrated/Angry
    example scores poorly here, which is exactly the failure mode
    val_accuracy-based checkpoint selection couldn't see on this
    imbalanced, stratified validation split."""
    y_pred_labels = tf.one_hot(tf.argmax(y_pred, axis=1), depth=tf.shape(y_true)[1])
    y_true = tf.cast(y_true, tf.float32)
    y_pred_labels = tf.cast(y_pred_labels, tf.float32)

    tp = tf.reduce_sum(y_true * y_pred_labels, axis=0)
    fp = tf.reduce_sum((1 - y_true) * y_pred_labels, axis=0)
    fn = tf.reduce_sum(y_true * (1 - y_pred_labels), axis=0)

    precision = tp / (tp + fp + tf.keras.backend.epsilon())
    recall = tp / (tp + fn + tf.keras.backend.epsilon())
    f1 = 2 * precision * recall / (precision + recall + tf.keras.backend.epsilon())
    return tf.reduce_mean(f1)


def make_focal_loss(gamma: float, alpha: np.ndarray):
    """Categorical focal loss (Lin et al. 2017), alpha = per-class weight
    array (index-aligned with `classes`, same boosted class_weights this
    script already computes - see MINORITY_BOOST above).

    EXPERIMENT RESULT (kept for the record, not used by default - see
    LOSS_FN below): tried with this exact alpha (the same boosted
    class_weights used for plain class-weighted CE) and gamma=2.0, seeded
    for a controlled comparison against categorical_crossentropy +
    class_weight. Result was clearly worse across the board (accuracy
    0.75 vs 0.81, macro-F1 0.69 vs 0.73, Frustrated F1 0.48 vs 0.56,
    Bored->Frustrated errors 526 vs 320) - likely because the full
    inverse-frequency-boosted alpha double-corrects for imbalance on top
    of the (1-p)^gamma term, which already implicitly upweights rare/hard
    classes (the original paper uses a mild fixed alpha like 0.25 for
    exactly this reason). A milder alpha might do better but wasn't
    re-tried, given diminishing returns after 4 full training runs and
    that the Bored<->Frustrated confusion looks like a genuine feature-
    level ambiguity at 48x48 resolution (a loss-function change shifts
    the decision boundary, it doesn't add information the model doesn't
    have) - see student_state.py's temporal-feature disambiguation for
    the more promising direction beyond this CNN's scope.

    alpha is applied here in the loss directly, NOT also passed as
    class_weight= to model.fit() - doing both would double-apply the
    per-class weighting on top of each other."""
    alpha_tensor = tf.constant(alpha, dtype=tf.float32)

    def loss_fn(y_true: tf.Tensor, y_pred: tf.Tensor) -> tf.Tensor:
        y_pred = tf.clip_by_value(y_pred, 1e-7, 1 - 1e-7)
        y_true = tf.cast(y_true, tf.float32)
        cross_entropy = -y_true * tf.math.log(y_pred)
        modulating_factor = tf.pow(1.0 - y_pred, gamma)
        weight = alpha_tensor * modulating_factor
        return tf.reduce_sum(weight * cross_entropy, axis=1)

    return loss_fn


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

# LOSS_FN=ce (default): categorical_crossentropy + class_weight=class_weights
# in model.fit() below - the winning configuration across all 4 seeded
# comparison runs (macro-F1 0.73, see MINORITY_BOOST above for the tuning
# history). LOSS_FN=focal re-runs the rejected focal-loss experiment (see
# make_focal_loss's docstring) for anyone who wants to reproduce it or try
# a milder alpha.
LOSS_FN = os.environ.get("LOSS_FN", "ce")
if LOSS_FN == "focal":
    FOCAL_GAMMA = float(os.environ.get("FOCAL_GAMMA", 2.0))
    # alpha index-aligned with `classes` (class_to_index), pulled from the
    # same boosted class_weights dict computed above rather than a
    # separate array, so MINORITY_BOOST and focal loss's alpha agree.
    focal_alpha = np.array([class_weights[i] for i in range(len(classes))], dtype="float32")
    print(f"Focal loss: gamma={FOCAL_GAMMA}, alpha={dict(zip(classes, focal_alpha.tolist()))}")
    loss = make_focal_loss(gamma=FOCAL_GAMMA, alpha=focal_alpha)
else:
    loss = "categorical_crossentropy"

model.compile(optimizer=Adam(learning_rate=0.001), loss=loss, metrics=["accuracy", macro_f1])
model.summary()

image_branch_params = sum(
    tf.size(w).numpy() for layer in model.layers
    for w in layer.trainable_weights
    if layer.name.startswith(("stem", "block", "image"))
)
print(f"\nImage-branch trainable params: {image_branch_params:,} "
      "(compare to MobileNetV2's ~2.3M for the equivalent backbone alone)")

checkpoint = ModelCheckpoint(
    f"model/best_custom_cnn_v4{RUN_TAG}.keras", monitor="val_macro_f1", save_best_only=True, mode="max", verbose=1
)
early_stop = EarlyStopping(monitor="val_macro_f1", patience=8, mode="max", restore_best_weights=True)
reduce_lr = ReduceLROnPlateau(monitor="val_loss", factor=0.2, patience=4, verbose=1, min_lr=1e-6)
callbacks = [checkpoint, early_stop, reduce_lr]

print("\n========== Training from scratch (no pretrained weights) ==========")
# class_weight only under CE - under focal loss, alpha inside
# make_focal_loss already applies the same boosted class_weights, so
# passing both would multiply them together.
fit_kwargs = {} if LOSS_FN == "focal" else {"class_weight": class_weights}
history = model.fit(train_ds, validation_data=val_ds, epochs=EPOCHS, callbacks=callbacks, **fit_kwargs)

model.save(f"model/custom_cnn_v4_final{RUN_TAG}.keras")
model.save(f"model/best_custom_cnn_v4{RUN_TAG}.h5")

with open(f"model/custom_cnn_class_indices_v4{RUN_TAG}.json", "w", encoding="utf-8") as f:
    json.dump({str(v): k for k, v in class_to_index.items()}, f, indent=2)

print("\nFinal custom CNN model saved!")

plt.figure(figsize=(10, 5))
plt.plot(history.history["accuracy"], label="Training Accuracy")
plt.plot(history.history["val_accuracy"], label="Validation Accuracy")
plt.xlabel("Epoch")
plt.ylabel("Accuracy")
plt.title(f"Custom Depthwise-Separable CNN Training Accuracy (v4{RUN_TAG})")
plt.legend()
plt.savefig(f"model/custom_cnn_training_accuracy_v4{RUN_TAG}.png")

plt.figure(figsize=(10, 5))
plt.plot(history.history["loss"], label="Training Loss")
plt.plot(history.history["val_loss"], label="Validation Loss")
plt.xlabel("Epoch")
plt.ylabel("Loss")
plt.title(f"Custom Depthwise-Separable CNN Training Loss (v4{RUN_TAG})")
plt.legend()
plt.savefig(f"model/custom_cnn_training_loss_v4{RUN_TAG}.png")

print("Training graphs saved!")
print(f"Best model saved as: model/best_custom_cnn_v4{RUN_TAG}.keras / model/best_custom_cnn_v4{RUN_TAG}.h5")

# =====================================
# Per-class breakdown on the held-out val set, using the best (restored)
# weights - printed here directly so a separate evaluate_*.py run isn't
# needed just to see which classes the val_macro_f1 checkpoint actually
# picked a strong model for.
# =====================================

val_predictions = model.predict(val_ds, verbose=0)
val_pred_labels = np.argmax(val_predictions, axis=1)
val_true_labels = label_indices[val_idx]

print("\n========== Per-class classification report (val set, best checkpoint) ==========")
print(classification_report(val_true_labels, val_pred_labels, target_names=classes))

cm = confusion_matrix(val_true_labels, val_pred_labels)
print("\nConfusion matrix (rows=actual, cols=predicted):")
print("classes:", classes)
print(cm)

plt.figure(figsize=(8, 8))
sns.heatmap(cm, annot=True, fmt="d", xticklabels=classes, yticklabels=classes)
plt.xlabel("Predicted")
plt.ylabel("Actual")
plt.title(f"Custom Depthwise-Separable CNN Confusion Matrix (v4{RUN_TAG})")
plt.tight_layout()
plt.savefig(f"model/custom_cnn_confusion_matrix_v4{RUN_TAG}.png")
print(f"Saved confusion matrix to model/custom_cnn_confusion_matrix_v4{RUN_TAG}.png")
