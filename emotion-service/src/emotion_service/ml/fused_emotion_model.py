from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import cv2
import mediapipe as mp
import numpy as np
from keras.models import load_model
from mediapipe.tasks.python import BaseOptions, vision
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

_ML_DIR = Path(__file__).resolve().parent
_SERVICE_DIR = _ML_DIR.parents[2]  # emotion-service/
_MODEL_DIR = _SERVICE_DIR / "model"

_ENV_MODEL_PATH = os.getenv("FUSED_MODEL_PATH")
_CANDIDATE_MODEL_FILES = ("best_fused_model.h5", "best_fused_model.keras", "fused_model_final.keras")

IMG_SIZE = 224
NUM_BLENDSHAPES = 52
FEATURE_DIM = NUM_BLENDSHAPES + 3 + 1  # blendshapes + pitch/yaw/roll + detected flag

LANDMARKER_MODEL_PATH = _MODEL_DIR / "mediapipe" / "face_landmarker.task"


def _resolve_model_path() -> Path:
    if _ENV_MODEL_PATH:
        return Path(_ENV_MODEL_PATH).expanduser().resolve()

    for filename in _CANDIDATE_MODEL_FILES:
        candidate = _MODEL_DIR / filename
        if candidate.exists():
            return candidate

    return _MODEL_DIR / "best_fused_model.h5"


MODEL_PATH = _resolve_model_path()


def _load_class_labels() -> list[str]:
    class_indices_path = _MODEL_DIR / "fused_class_indices.json"
    with open(class_indices_path, "r", encoding="utf-8") as f:
        mapping = json.load(f)
    return [mapping[str(i)] for i in range(len(mapping))]


EMOTION_LABELS = _load_class_labels()


def _load_fused_model() -> Any:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Fused emotion model not found: {MODEL_PATH}. Run train_fused_model.py "
            "(after scripts/extract_facial_features.py) to produce it."
        )
    return load_model(MODEL_PATH)


FUSED_MODEL = _load_fused_model()


def _load_landmarker() -> vision.FaceLandmarker:
    options = vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(LANDMARKER_MODEL_PATH)),
        output_face_blendshapes=True,
        output_facial_transformation_matrixes=True,
        num_faces=1,
    )
    return vision.FaceLandmarker.create_from_options(options)


LANDMARKER = _load_landmarker()


def _rotation_to_euler(matrix: np.ndarray) -> tuple[float, float, float]:
    """Same decomposition used at training time - see
    scripts/extract_facial_features.py for the rationale."""
    r = matrix[:3, :3]
    sy = float(np.sqrt(r[0, 0] ** 2 + r[1, 0] ** 2))
    singular = sy < 1e-6

    if not singular:
        pitch = np.arctan2(r[2, 1], r[2, 2])
        yaw = np.arctan2(-r[2, 0], sy)
        roll = np.arctan2(r[1, 0], r[0, 0])
    else:
        pitch = np.arctan2(-r[1, 2], r[1, 1])
        yaw = np.arctan2(-r[2, 0], sy)
        roll = 0.0

    return float(pitch), float(yaw), float(roll)


def _extract_landmark_features(face_image_bgr: np.ndarray) -> np.ndarray:
    """Same feature layout used at training time: 52 blendshapes + pitch/
    yaw/roll + a detected flag. Returns an all-zero vector (detected=0)
    when MediaPipe can't find landmarks in the crop, matching the training
    cache's handling of failed extractions."""
    rgb = cv2.cvtColor(face_image_bgr, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    result = LANDMARKER.detect(mp_image)

    features = np.zeros(FEATURE_DIM, dtype="float32")
    if not result.face_blendshapes or not result.facial_transformation_matrixes:
        return features

    for i, category in enumerate(result.face_blendshapes[0][:NUM_BLENDSHAPES]):
        features[i] = category.score

    matrix = np.array(result.facial_transformation_matrixes[0])
    pitch, yaw, roll = _rotation_to_euler(matrix)
    features[NUM_BLENDSHAPES] = pitch
    features[NUM_BLENDSHAPES + 1] = yaw
    features[NUM_BLENDSHAPES + 2] = roll
    features[NUM_BLENDSHAPES + 3] = 1.0

    return features


def _preprocess_image(face_image_bgr: np.ndarray) -> np.ndarray:
    rgb = cv2.cvtColor(face_image_bgr, cv2.COLOR_BGR2RGB)
    resized = cv2.resize(rgb, (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_CUBIC)
    return preprocess_input(resized.astype("float32"))


def predict_emotion_with_confidence(face_image_bgr: np.ndarray) -> tuple[str, float]:
    """Predict facial expression from a color (BGR) face crop, fusing the
    MobileNetV2 image branch with MediaPipe blendshape/head-pose features."""
    if face_image_bgr is None or face_image_bgr.size == 0:
        raise ValueError("Cannot predict emotion from an empty face image.")

    if face_image_bgr.ndim == 2:
        face_image_bgr = cv2.cvtColor(face_image_bgr, cv2.COLOR_GRAY2BGR)

    try:
        image_tensor = np.expand_dims(_preprocess_image(face_image_bgr), axis=0)
        feature_vector = np.expand_dims(_extract_landmark_features(face_image_bgr), axis=0)
        prediction = FUSED_MODEL.predict([image_tensor, feature_vector], verbose=0)
        probabilities = np.asarray(prediction[0], dtype="float32")
        emotion_index = int(np.argmax(probabilities))
        confidence = float(np.max(probabilities))
    except Exception as exc:
        raise RuntimeError(f"Fused emotion prediction failed: {exc}") from exc

    if emotion_index < 0 or emotion_index >= len(EMOTION_LABELS):
        return "Unknown", 0.0

    return EMOTION_LABELS[emotion_index], confidence


def predict_emotion(face_image_bgr: np.ndarray) -> str:
    label, _ = predict_emotion_with_confidence(face_image_bgr)
    return label
