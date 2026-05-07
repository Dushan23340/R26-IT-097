from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from keras.models import load_model

# Resolve model path relative to this file:
# emotion-service/src/emotion_service/ml/emotion_model.py
_ML_DIR = Path(__file__).resolve().parent
_SRC_DIR = _ML_DIR.parents[2]  # emotion-service/src
_SERVICE_DIR = _SRC_DIR.parent  # emotion-service/

MODEL_PATH = _SERVICE_DIR / "model" / "emotion_model.hdf5"
EMOTION_LABELS = ["Angry", "Disgust", "Fear", "Happy", "Sad", "Surprise", "Neutral"]
INPUT_SIZE = (48, 48)


def _load_emotion_model():
    """Load the FER model once at import time."""
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Emotion model file not found: {MODEL_PATH}. "
            "Place your pre-trained model at emotion-service/model/emotion_model.hdf5."
        )

    try:
        model = load_model(MODEL_PATH)
    except Exception as exc:
        raise RuntimeError(f"Failed to load emotion model from {MODEL_PATH}: {exc}") from exc

    return model


EMOTION_MODEL = _load_emotion_model()


def _preprocess_face(face_image: np.ndarray) -> np.ndarray:
    """Preprocess a grayscale face ROI to model input shape."""
    resized = cv2.resize(face_image, INPUT_SIZE, interpolation=cv2.INTER_AREA)
    normalized = resized.astype("float32") / 255.0
    # Most FER models use (batch, 48, 48, 1).
    return np.expand_dims(np.expand_dims(normalized, axis=-1), axis=0)


def predict_emotion(face_image: np.ndarray) -> str:
    """
    Predict emotion label from a grayscale face ROI.

    Returns:
        A label from EMOTION_LABELS.
    """
    if face_image is None or face_image.size == 0:
        raise ValueError("Cannot predict emotion from an empty face image.")

    try:
        input_tensor = _preprocess_face(face_image)
        prediction = EMOTION_MODEL.predict(input_tensor, verbose=0)
        emotion_index = int(np.argmax(prediction))
    except Exception as exc:
        raise RuntimeError(f"Emotion prediction failed: {exc}") from exc

    if emotion_index < 0 or emotion_index >= len(EMOTION_LABELS):
        return "Unknown"

    return EMOTION_LABELS[emotion_index]

