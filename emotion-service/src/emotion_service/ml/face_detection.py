from __future__ import annotations

from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions, vision

# Haar Cascade was sensitive to lighting/pose and missed partially rotated
# faces in classroom conditions. MediaPipe's BlazeFace detector is more
# robust to those and still runs comfortably in real time on CPU.
_ML_DIR = Path(__file__).resolve().parent
_SERVICE_DIR = _ML_DIR.parents[2]  # emotion-service/
MODEL_PATH = _SERVICE_DIR / "model" / "mediapipe" / "blaze_face_short_range.tflite"

MIN_DETECTION_CONFIDENCE = 0.5


def _load_face_detector() -> vision.FaceDetector:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"MediaPipe face detector model not found: {MODEL_PATH}. "
            "Download blaze_face_short_range.tflite from the MediaPipe model "
            "zoo into emotion-service/model/mediapipe/."
        )

    options = vision.FaceDetectorOptions(
        base_options=BaseOptions(model_asset_path=str(MODEL_PATH)),
        min_detection_confidence=MIN_DETECTION_CONFIDENCE,
    )
    return vision.FaceDetector.create_from_options(options)


FACE_DETECTOR = _load_face_detector()


def detect_faces(
    frame: np.ndarray,
    gray_frame: np.ndarray | None = None,
) -> list[tuple[int, int, int, int]]:
    """
    Detect faces in a BGR frame and return bounding boxes.

    `gray_frame` is accepted for backward compatibility with the previous
    Haar Cascade signature but is unused - MediaPipe detects on the color
    image directly.

    Returns:
        list of (x, y, w, h) tuples
    """
    if frame is None or frame.size == 0:
        return []

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    result = FACE_DETECTOR.detect(mp_image)

    height, width = frame.shape[:2]
    boxes: list[tuple[int, int, int, int]] = []

    for detection in result.detections:
        bbox = detection.bounding_box
        x = max(0, bbox.origin_x)
        y = max(0, bbox.origin_y)
        w = min(bbox.width, width - x)
        h = min(bbox.height, height - y)
        if w <= 0 or h <= 0:
            continue
        boxes.append((int(x), int(y), int(w), int(h)))

    return boxes
