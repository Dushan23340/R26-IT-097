from __future__ import annotations

import base64
import logging
import os
import sys
import threading
import time
import traceback
from pathlib import Path

import cv2
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS

# =========================================================
# PATH SETUP
# =========================================================

SERVICE_DIR = Path(__file__).resolve().parent
SRC_DIR = SERVICE_DIR / "src"

if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

# =========================================================
# IMPORTS
# =========================================================

from emotion_service.ml.face_detection import detect_faces
from emotion_service.ml.emotion_model import MODEL_PATH, predict_emotion
from emotion_service.ml.emotion_tracker import EmotionTracker

# =========================================================
# APP SETUP
# =========================================================

app = Flask(__name__)

CORS(app, resources={r"/*": {"origins": "*"}})

app.logger.setLevel(logging.INFO)

tracker = EmotionTracker()

# Prevent TensorFlow concurrent prediction issues
_PREDICTION_LOCK = threading.Lock()

# =========================================================
# HELPER FUNCTIONS
# =========================================================

def _decode_base64_image(data_url_or_b64: str) -> np.ndarray | None:
    """
    Converts base64 image into OpenCV frame.
    """

    if not data_url_or_b64:
        return None

    b64_part = data_url_or_b64

    if "," in data_url_or_b64 and data_url_or_b64.startswith("data:"):
        b64_part = data_url_or_b64.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(b64_part, validate=True)
    except Exception:
        try:
            image_bytes = base64.b64decode(b64_part)
        except Exception:
            return None

    npimg = np.frombuffer(image_bytes, np.uint8)

    frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

    return frame


def _map_raw_to_student_state(raw_emotion: str) -> str:
    """
    Convert raw FER emotions into engagement states.
    """

    raw = (raw_emotion or "").strip().lower()

    if raw in {"happy", "neutral", "surprise"}:
        return "Engaged"

    if raw in {"sad"}:
        return "Bored"

    if raw in {"fear"}:
        return "Confused"

    if raw in {"angry", "disgust"}:
        return "Frustrated"

    return "Engaged"


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)

    if value is None:
        return default

    return value.strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }

# =========================================================
# ROUTES
# =========================================================

@app.route("/")
def home():

    return jsonify({
        "message": "Emotion Detection API Running"
    })


@app.route("/health", methods=["GET"])
def health():

    return jsonify({
        "status": "ok",
        "service": "emotion-service",
        "modelLoaded": True,
        "modelPath": str(MODEL_PATH),
    }), 200


@app.route("/predict", methods=["POST"])
def predict():

    payload = request.get_json(silent=True) or {}

    image_b64 = payload.get("image")

    # Student ID from frontend
    student_id = payload.get("studentId", "default_student")

    if not image_b64:
        return jsonify({
            "error": "No image provided"
        }), 400

    # =====================================================
    # Decode image
    # =====================================================

    frame = _decode_base64_image(image_b64)

    if frame is None:
        return jsonify({
            "error": "Invalid image"
        }), 400

    # =====================================================
    # Convert to grayscale
    # =====================================================

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # =====================================================
    # Detect faces
    # =====================================================

    faces = detect_faces(frame, gray_frame=gray)

    if len(faces) == 0:
        return jsonify({
            "emotion": "No face detected"
        }), 200

    # =====================================================
    # Get first face
    # =====================================================

    x, y, w, h = faces[0]

    x = max(0, x)
    y = max(0, y)

    x2 = min(gray.shape[1], x + w)
    y2 = min(gray.shape[0], y + h)

    if x2 <= x or y2 <= y:
        return jsonify({
            "emotion": "No face detected"
        }), 200

    face_roi = gray[y:y2, x:x2]

    if face_roi.size == 0:
        return jsonify({
            "emotion": "No face detected"
        }), 200

    # =====================================================
    # Predict emotion
    # =====================================================

    try:

        with _PREDICTION_LOCK:
            raw_emotion = predict_emotion(face_roi)

        student_state = _map_raw_to_student_state(raw_emotion)

        # =================================================
        # TRACK EMOTION DATA
        # =================================================

        tracker.update(student_id, student_state)

        analytics = tracker.get_metrics(student_id)

        # =================================================
        # RETURN RESPONSE
        # =================================================

        return jsonify({

            # Current emotion
            "emotion": student_state,
            "rawEmotion": raw_emotion,

            # Analytics
            "emotionDuration": analytics["emotionDuration"],
            "transitionRate": analytics["transitionRate"],
            "stabilityScore": analytics["stabilityScore"],

            # Optional debug data
            "emotionCounts": analytics["emotionCounts"],
            "totalTransitions": analytics["totalTransitions"]

        }), 200

    except Exception as exc:

        app.logger.error("Prediction failure: %s", exc)

        app.logger.debug(
            "Prediction traceback:\n%s",
            traceback.format_exc()
        )

        return jsonify({
            "error": str(exc)
        }), 500


# =========================================================
# MAIN
# =========================================================

if __name__ == "__main__":

    port = int(os.getenv("EMOTION_SERVICE_PORT", "5001"))

    debug = _env_bool(
        "EMOTION_SERVICE_DEBUG",
        True
    )

    use_reloader = _env_bool(
        "EMOTION_SERVICE_RELOADER",
        False
    )

    app.run(
        debug=debug,
        use_reloader=use_reloader,
        port=port
    )