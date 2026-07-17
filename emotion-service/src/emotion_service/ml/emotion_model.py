from __future__ import annotations

from pathlib import Path
import os

import cv2
import numpy as np
from keras.models import load_model

# Resolve model path relative to this file:
# emotion-service/src/emotion_service/ml/emotion_model.py
_ML_DIR = Path(__file__).resolve().parent
_SRC_DIR = _ML_DIR.parents[1]  # emotion-service/src
_SERVICE_DIR = _ML_DIR.parents[2]  # emotion-service/

_MODEL_DIR = _SERVICE_DIR / "model"

# Allow overriding model path via env (useful for deployments / experiments).
_ENV_MODEL_PATH = os.getenv("EMOTION_MODEL_PATH")

# Common model filenames we support out of the box (in priority order).
_CANDIDATE_MODEL_FILES = (
    "best_emotion_model.h5",
    "emotion_mobilenetv2.h5",
    "emotion_model.hdf5",
    "emotion_model.h5",
)


def _resolve_model_path() -> Path:
    if _ENV_MODEL_PATH:
        return Path(_ENV_MODEL_PATH).expanduser().resolve()

    for filename in _CANDIDATE_MODEL_FILES:
        candidate = _MODEL_DIR / filename
        if candidate.exists():
            return candidate

    # Default to the previous expected path for a clear error message.
    return _MODEL_DIR / "emotion_model.hdf5"


MODEL_PATH = _resolve_model_path()
EMOTION_LABELS = ["Angry", "Disgust", "Fear", "Happy", "Sad", "Surprise", "Neutral"]


def _load_emotion_model():
    """Load the FER model once at import time."""
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Emotion model file not found: {MODEL_PATH}. "
            "Place your pre-trained model in emotion-service/model/ (e.g. best_emotion_model.h5) "
            'or set EMOTION_MODEL_PATH="/absolute/path/to/model.h5".'
        )

    try:
        model = load_model(MODEL_PATH)
    except Exception as exc:
        raise RuntimeError(f"Failed to load emotion model from {MODEL_PATH}: {exc}") from exc

    return model


EMOTION_MODEL = _load_emotion_model()

# Example Keras input shape: (None, 224, 224, 3)
_MODEL_INPUT_SHAPE = EMOTION_MODEL.input_shape
if isinstance(_MODEL_INPUT_SHAPE, list):
    _MODEL_INPUT_SHAPE = _MODEL_INPUT_SHAPE[0]
if len(_MODEL_INPUT_SHAPE) != 4:
    raise RuntimeError(f"Unsupported model input shape: {_MODEL_INPUT_SHAPE}")

_MODEL_HEIGHT = int(_MODEL_INPUT_SHAPE[1] or 224)
_MODEL_WIDTH = int(_MODEL_INPUT_SHAPE[2] or 224)
_MODEL_CHANNELS = int(_MODEL_INPUT_SHAPE[3] or 3)


def _apply_gamma_correction(image: np.ndarray, gamma: float = 1.2) -> np.ndarray:
    """Improve contrast on underexposed or low-light face crops."""
    inv_gamma = 1.0 / gamma
    table = np.array([((i / 255.0) ** inv_gamma) * 255 for i in np.arange(256)], dtype="uint8")
    return cv2.LUT(image, table)


def _preprocess_face(face_image: np.ndarray) -> np.ndarray:
    """Preprocess a grayscale face ROI to match loaded model input shape."""
    gray = face_image.astype(np.uint8)
    if gray.ndim != 2:
        gray = cv2.cvtColor(gray, cv2.COLOR_BGR2GRAY)

    gray = cv2.equalizeHist(gray)
    gray = _apply_gamma_correction(gray, gamma=1.2)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    filtered = cv2.bilateralFilter(enhanced, d=5, sigmaColor=75, sigmaSpace=75)

    resized = cv2.resize(
        filtered,
        (_MODEL_WIDTH, _MODEL_HEIGHT),
        interpolation=cv2.INTER_CUBIC if (_MODEL_WIDTH >= face_image.shape[1] or _MODEL_HEIGHT >= face_image.shape[0]) else cv2.INTER_AREA,
    )

    if _MODEL_CHANNELS == 3:
        processed = cv2.cvtColor(resized, cv2.COLOR_GRAY2RGB)
    elif _MODEL_CHANNELS == 1:
        processed = np.expand_dims(resized, axis=-1)
    else:
        raise RuntimeError(f"Unsupported channel count in model input: {_MODEL_CHANNELS}")

    normalized = processed.astype("float32") / 255.0
    return np.expand_dims(normalized, axis=0)


def predict_emotion_with_confidence(face_image: np.ndarray) -> tuple[str, float]:
    """Predict emotion label and confidence from a grayscale face ROI."""
    if face_image is None or face_image.size == 0:
        raise ValueError("Cannot predict emotion from an empty face image.")

    try:
        input_tensor = _preprocess_face(face_image)
        prediction = EMOTION_MODEL.predict(input_tensor, verbose=0)
        probabilities = np.asarray(prediction[0], dtype="float32")
        emotion_index = int(np.argmax(probabilities))
        confidence = float(np.max(probabilities))
    except Exception as exc:
        raise RuntimeError(f"Emotion prediction failed: {exc}") from exc

    if emotion_index < 0 or emotion_index >= len(EMOTION_LABELS):
        return "Unknown", 0.0

    return EMOTION_LABELS[emotion_index], confidence


def predict_emotion(face_image: np.ndarray) -> str:
    """Predict emotion label from a grayscale face ROI."""
    label, _ = predict_emotion_with_confidence(face_image)
    return label

