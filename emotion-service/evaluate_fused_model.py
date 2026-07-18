"""Per-class evaluation of the fused model on the same held-out validation
split used during training (same random_state/stratify, so no leakage)."""

import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from tensorflow.keras.models import load_model
import tensorflow as tf

FEATURES_PATH = "dataset/facial_features.npz"
IMG_SIZE = 224
BATCH_SIZE = 32
VAL_SPLIT = 0.2
SEED = 42

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


def _load_image(path):
    raw = tf.io.read_file(path)
    image = tf.io.decode_jpeg(raw, channels=3)
    image = tf.image.resize(image, (IMG_SIZE, IMG_SIZE))
    return preprocess_input(image)


def _map(path, feature_vec, label):
    return (_load_image(path), feature_vec), label


val_ds = (
    tf.data.Dataset.from_tensor_slices((val_paths, val_features, val_labels))
    .map(_map, num_parallel_calls=tf.data.AUTOTUNE)
    .batch(BATCH_SIZE)
    .prefetch(tf.data.AUTOTUNE)
)

print("Loading model/best_fused_model.keras")
model = load_model("model/best_fused_model.keras")

predictions = model.predict(val_ds, verbose=1)
y_pred = np.argmax(predictions, axis=1)
y_true = val_labels

print(classification_report(y_true, y_pred, target_names=classes))

cm = confusion_matrix(y_true, y_pred)
plt.figure(figsize=(8, 8))
sns.heatmap(cm, annot=True, fmt="d", xticklabels=classes, yticklabels=classes)
plt.xlabel("Predicted")
plt.ylabel("Actual")
plt.tight_layout()
plt.savefig("model/fused_confusion_matrix.png")
print("Saved confusion matrix to model/fused_confusion_matrix.png")
