from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

CASCADE_FILENAME = "haarcascade_frontalface_default.xml"
CASCADE_PATH = Path(getattr(cv2, "data").haarcascades) / CASCADE_FILENAME


def _load_face_cascade() -> cv2.CascadeClassifier:
    """Load and validate the Haar Cascade face detector."""
    if not CASCADE_PATH.exists():
        raise FileNotFoundError(
            f"Haar Cascade file not found: {CASCADE_PATH}. "
            "Please ensure OpenCV data files are installed."
        )

    cascade = cv2.CascadeClassifier(str(CASCADE_PATH))
    if cascade.empty():
        raise RuntimeError(f"Failed to load Haar Cascade classifier from {CASCADE_PATH}.")

    return cascade


FACE_CASCADE = _load_face_cascade()


def detect_faces(
    frame: np.ndarray,
    gray_frame: np.ndarray | None = None,
) -> list[tuple[int, int, int, int]]:
    """
    Detect faces in a BGR frame and return bounding boxes.

    Returns:
        list of (x, y, w, h) tuples
    """
    if frame is None or frame.size == 0:
        return []

    gray = gray_frame if gray_frame is not None else cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = FACE_CASCADE.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(30, 30),
    )
    if faces is None or len(faces) == 0:
        return []

    return [(int(f[0]), int(f[1]), int(f[2]), int(f[3])) for f in faces]

