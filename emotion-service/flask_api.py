from __future__ import annotations

import base64
import logging
import os
import sys
import threading
import traceback
from pathlib import Path

import cv2
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS

# Setup paths
SERVICE_DIR = Path(__file__).resolve().parent
SRC_DIR = SERVICE_DIR / "src"

if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from emotion_service.ml.face_detection import detect_faces
from emotion_service.ml.emotion_model import MODEL_PATH, predict_emotion

app = Flask(__name__)

# Allow the React frontend to call this service in dev.
# In production you should restrict origins via env/config.
CORS(app, resources={r"/*": {"origins": "*"}})
app.logger.setLevel(logging.INFO)

# TensorFlow/Keras inference can throw intermittent runtime errors
# under concurrent access in dev servers. Keep predictions serialized.
_PREDICTION_LOCK = threading.Lock()


def _decode_base64_image(data_url_or_b64: str) -> np.ndarray | None:
    """
    Accepts either a data URL (data:image/jpeg;base64,...) or raw base64.
    Returns a decoded BGR OpenCV frame or None.
    """
    if not data_url_or_b64:
        return None

    b64_part = data_url_or_b64
    if "," in data_url_or_b64 and data_url_or_b64.strip().startswith("data:"):
        b64_part = data_url_or_b64.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(b64_part, validate=True)
    except Exception:
        # Some browsers include newlines or padding quirks; retry without validate.
        try:
            image_bytes = base64.b64decode(b64_part)
        except Exception:
            return None

    npimg = np.frombuffer(image_bytes, np.uint8)
    frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    return frame


def _map_raw_to_student_state(raw_emotion: str) -> str:
    """
    Map model labels -> student-friendly states.
    """
    raw = (raw_emotion or "").strip().lower()
    if raw in {"happy", "surprise", "neutral"}:
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
    return value.strip().lower() in {"1", "true", "yes", "on"}

@app.route("/")
def home():
    return jsonify({
        "message": "Emotion Detection API Running"
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify(
        {
            "status": "ok",
            "service": "emotion-service",
            "modelLoaded": True,
            "modelPath": str(MODEL_PATH),
        }
    ), 200

@app.route("/predict", methods=["POST"])
def predict():
    payload = request.get_json(silent=True) or {}
    image_b64 = payload.get("image")
    if not image_b64:
        return jsonify({"error": "No image provided"}), 400

    frame = _decode_base64_image(image_b64)

    if frame is None:
        return jsonify({"error": "Invalid image"}), 400

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    faces = detect_faces(frame, gray_frame=gray)

    if len(faces) == 0:
        return jsonify({"emotion": "No face detected"}), 200

    x, y, w, h = faces[0]
    x = max(0, x)
    y = max(0, y)
    w = max(0, w)
    h = max(0, h)
    x2 = min(gray.shape[1], x + w)
    y2 = min(gray.shape[0], y + h)
    if x2 <= x or y2 <= y:
        return jsonify({"emotion": "No face detected"}), 200

    face_roi = gray[y:y2, x:x2]
    if face_roi.size == 0:
        return jsonify({"emotion": "No face detected"}), 200

    try:
        with _PREDICTION_LOCK:
            raw_emotion = predict_emotion(face_roi)
        student_state = _map_raw_to_student_state(raw_emotion)
        return jsonify({"emotion": student_state, "rawEmotion": raw_emotion}), 200

    except Exception as exc:
        app.logger.error("Prediction failure: %s", exc)
        app.logger.debug("Prediction traceback:\n%s", traceback.format_exc())
        return jsonify({"error": str(exc)}), 500

if __name__ == "__main__":
    port = int(os.getenv("EMOTION_SERVICE_PORT", "5001"))
    debug = _env_bool("EMOTION_SERVICE_DEBUG", True)
    use_reloader = _env_bool("EMOTION_SERVICE_RELOADER", False)

    app.run(debug=debug, use_reloader=use_reloader, port=port)