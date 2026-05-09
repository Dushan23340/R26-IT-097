import cv2
import numpy as np
from tensorflow.keras.models import load_model

# Load model
model = load_model("model/best_emotion_model.h5")

# Emotion labels
labels = [
    "Bored",
    "Confused",
    "Engaged",
    "Frustrated"
]

# Load image
image_path = "test.jpg"

img = cv2.imread(image_path)

if img is None:
    print("Image not found!")
    exit()

# Resize
img_resized = cv2.resize(img, (224, 224))

# Normalize
img_normalized = img_resized / 255.0

# Reshape
input_img = np.expand_dims(img_normalized, axis=0)

# Prediction
prediction = model.predict(input_img)

predicted_class = np.argmax(prediction)

confidence = np.max(prediction)

print(f"Predicted Emotion: {labels[predicted_class]}")
print(f"Confidence: {confidence:.2f}")