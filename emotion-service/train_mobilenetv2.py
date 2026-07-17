import os
import numpy as np
import matplotlib.pyplot as plt
import tensorflow as tf

from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.layers import Dense, Dropout, GlobalAveragePooling2D
from tensorflow.keras.models import Model
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import (
    EarlyStopping,
    ModelCheckpoint,
    ReduceLROnPlateau
)
from sklearn.utils.class_weight import compute_class_weight

# =====================================
# SETTINGS
# =====================================

DATASET_DIR = "dataset/final_dataset"

IMG_SIZE = 224
BATCH_SIZE = 32

HEAD_EPOCHS = 8
FINE_TUNE_EPOCHS = 12

os.makedirs("model", exist_ok=True)

# =====================================
# DATA GENERATORS
# =====================================

train_datagen = ImageDataGenerator(
    rescale=1./255,
    validation_split=0.2,

    rotation_range=15,
    zoom_range=0.15,
    width_shift_range=0.10,
    height_shift_range=0.10,
    brightness_range=[0.8, 1.2],
    horizontal_flip=True
)

val_datagen = ImageDataGenerator(
    rescale=1./255,
    validation_split=0.2
)

train_data = train_datagen.flow_from_directory(
    DATASET_DIR,
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode='categorical',
    subset='training',
    shuffle=True
)

val_data = val_datagen.flow_from_directory(
    DATASET_DIR,
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode='categorical',
    subset='validation',
    shuffle=False
)

# =====================================
# CLASS WEIGHTS
# =====================================

weights = compute_class_weight(
    class_weight="balanced",
    classes=np.unique(train_data.classes),
    y=train_data.classes
)

class_weights = dict(enumerate(weights))

print("\nClass Labels")
print(train_data.class_indices)

print("\nClass Weights")
print(class_weights)

# =====================================
# LOAD MOBILENETV2
# =====================================

base_model = MobileNetV2(
    weights="imagenet",
    include_top=False,
    input_shape=(IMG_SIZE, IMG_SIZE, 3)
)

base_model.trainable = False

# =====================================
# CLASSIFIER HEAD
# =====================================

x = base_model.output

x = GlobalAveragePooling2D()(x)

x = Dense(256, activation="relu")(x)

x = Dropout(0.5)(x)

predictions = Dense(
    train_data.num_classes,
    activation="softmax"
)(x)

model = Model(
    inputs=base_model.input,
    outputs=predictions
)

# =====================================
# COMPILE (HEAD TRAINING)
# =====================================

model.compile(
    optimizer=Adam(learning_rate=0.001),
    loss="categorical_crossentropy",
    metrics=["accuracy"]
)

# =====================================
# CALLBACKS
# =====================================

checkpoint = ModelCheckpoint(
    "model/best_emotion_model.keras",
    monitor="val_accuracy",
    save_best_only=True,
    mode="max",
    verbose=1
)

early_stop = EarlyStopping(
    monitor="val_accuracy",
    patience=5,
    mode="max",
    restore_best_weights=True
)

reduce_lr = ReduceLROnPlateau(
    monitor="val_loss",
    factor=0.2,
    patience=3,
    verbose=1,
    min_lr=1e-6
)

callbacks = [
    checkpoint,
    early_stop,
    reduce_lr
]

# =====================================
# STAGE 1
# Train classifier head
# =====================================

print("\n========== Stage 1 ==========")
print("Training classifier head...")

history1 = model.fit(
    train_data,
    validation_data=val_data,
    epochs=HEAD_EPOCHS,
    class_weight=class_weights,
    callbacks=callbacks
)

# =====================================
# STAGE 2
# Fine tune MobileNetV2
# =====================================

print("\n========== Stage 2 ==========")
print("Fine tuning last MobileNetV2 layers...")

base_model.trainable = True

for layer in base_model.layers[:-30]:
    layer.trainable = False

model.compile(
    optimizer=Adam(learning_rate=1e-4),
    loss="categorical_crossentropy",
    metrics=["accuracy"]
)

history2 = model.fit(
    train_data,
    validation_data=val_data,
    epochs=FINE_TUNE_EPOCHS,
    class_weight=class_weights,
    callbacks=callbacks
)

# =====================================
# SAVE FINAL MODEL
# =====================================

model.save("model/emotion_mobilenetv2_final.keras")

print("\nFinal model saved!")

# =====================================
# MERGE HISTORY
# =====================================

accuracy = history1.history["accuracy"] + history2.history["accuracy"]
val_accuracy = history1.history["val_accuracy"] + history2.history["val_accuracy"]

loss = history1.history["loss"] + history2.history["loss"]
val_loss = history1.history["val_loss"] + history2.history["val_loss"]

# =====================================
# ACCURACY GRAPH
# =====================================

plt.figure(figsize=(10,5))

plt.plot(accuracy, label="Training Accuracy")
plt.plot(val_accuracy, label="Validation Accuracy")

plt.xlabel("Epoch")
plt.ylabel("Accuracy")
plt.title("Training Accuracy")

plt.legend()

plt.savefig("model/training_accuracy.png")

# =====================================
# LOSS GRAPH
# =====================================

plt.figure(figsize=(10,5))

plt.plot(loss, label="Training Loss")
plt.plot(val_loss, label="Validation Loss")

plt.xlabel("Epoch")
plt.ylabel("Loss")
plt.title("Training Loss")

plt.legend()

plt.savefig("model/training_loss.png")

print("Training graphs saved!")

print("\nTraining completed successfully!")
print("Best model saved as:")
print("model/best_emotion_model.keras")