import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import confusion_matrix, classification_report
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from pathlib import Path

DATASET_DIR = "dataset/expression_dataset"
IMG_SIZE = 224
BATCH_SIZE = 32

model_path = Path("model/best_emotion_model.keras")
if not model_path.exists():
    model_path = Path("model/best_emotion_model.h5")
    if not model_path.exists():
        raise FileNotFoundError(
            "No model found at model/best_emotion_model.keras or model/best_emotion_model.h5"
        )

print(f"Loading model from {model_path}")
model = load_model(str(model_path))

val_datagen = ImageDataGenerator(
    rescale=1.0 / 255.0,
    validation_split=0.2
)

validation_generator = val_datagen.flow_from_directory(
    DATASET_DIR,
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode='categorical',
    subset='validation',
    shuffle=False
)

predictions = model.predict(validation_generator, verbose=1)

y_pred = np.argmax(predictions, axis=1)
y_true = validation_generator.classes

cm = confusion_matrix(y_true, y_pred)

print(classification_report(
    y_true,
    y_pred,
    target_names=list(validation_generator.class_indices.keys())
))

plt.figure(figsize=(8, 8))

sns.heatmap(
    cm,
    annot=True,
    fmt="d",
    xticklabels=list(validation_generator.class_indices.keys()),
    yticklabels=list(validation_generator.class_indices.keys())
)

plt.xlabel("Predicted")
plt.ylabel("Actual")
plt.tight_layout()

plt.savefig("model/confusion_matrix.png")
print("Saved confusion matrix to model/confusion_matrix.png")
