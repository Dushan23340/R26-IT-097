from __future__ import annotations

import base64
import logging
import os
import sys
import threading
import time
import traceback
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).resolve().parent / ".env")

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
from emotion_service.ml.fused_emotion_model import MODEL_PATH, predict_emotion_with_confidence
from emotion_service.ml.emotion_tracker import EmotionTracker
from emotion_service.ml.realtime_pipeline import map_raw_to_student_state
from emotion_service.ml.student_state import compute_attention_score

# =========================================================
# APP SETUP
# =========================================================

app = Flask(__name__)

CORS(app, resources={r"/*": {"origins": "*"}})  # type: ignore

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

    if npimg.size == 0:
        return None

    try:
        frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    except Exception:
        return None

    return frame


def _map_raw_to_student_state(
    raw_emotion: str,
    confidence: float,
    previous_state: str | None = None,
    probabilities: list[float] | None = None,
    stability_score: float = 0.0,
    transition_rate: float = 0.0,
    current_continuous_duration: float = 0.0,
) -> str:
    """Convert raw FER emotions into engagement states using confidence gating."""
    return map_raw_to_student_state(
        raw_emotion,
        confidence=confidence,
        previous_state=previous_state,
        probabilities=probabilities,
        stability_score=stability_score,
        transition_rate=transition_rate,
        current_continuous_duration=current_continuous_duration,
    )


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


@app.route("/students", methods=["GET"])
def students():
    """Real-time snapshot of every student currently being tracked by this
    process. In-memory only (no persistence) - intended for a dashboard or
    a downstream analytics service to poll."""

    all_students = tracker.get_all_students()

    results = [
        {
            "studentId": student_id,
            "currentEmotion": metrics.get("currentEmotion", "Neutral"),
            "stabilityScore": metrics.get("stabilityScore", 0.0),
            "transitionRate": metrics.get("transitionRate", 0.0),
            "emotionCounts": metrics.get("emotionCounts", {}),
            "engagementIndicators": metrics.get("engagementIndicators", {}),
            "lastSeenTimestamp": metrics.get("lastSeenTimestamp"),
        }
        for student_id, metrics in all_students.items()
    ]

    return jsonify({"students": results, "count": len(results)}), 200


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

    print("Frame shape:", frame.shape, flush=True)
    cv2.imwrite("debug_frame.jpg", frame)

    # =====================================================
    # Convert to grayscale
    # =====================================================

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # =====================================================
    # Detect faces
    # =====================================================

    faces = detect_faces(frame, gray_frame=gray)

    print("Number of faces detected:", len(faces), flush=True)

    if len(faces) == 0:
        return jsonify({
            "emotion": "No face detected"
        }), 200

    # =====================================================
    # Get first face and expand the ROI to include contextual features
    # =====================================================

    def expand_face_box(x_val, y_val, w_val, h_val, frame_shape, margin=0.18):
        height, width = frame_shape[:2]
        dx = int(w_val * margin)
        dy = int(h_val * margin)
        x1 = max(0, x_val - dx)
        y1 = max(0, y_val - dy)
        x2 = min(width, x_val + w_val + dx)
        y2 = min(height, y_val + h_val + dy)
        return x1, y1, x2, y2

    x, y, w, h = faces[0]
    x1, y1, x2, y2 = expand_face_box(x, y, w, h, gray.shape, margin=0.18)

    if x2 <= x1 or y2 <= y1:
        return jsonify({
            "emotion": "No face detected"
        }), 200

    # Fused model uses the color crop directly (image branch + MediaPipe
    # landmark/blendshape branch both need real color+resolution, unlike
    # the old grayscale-only pipeline).
    face_roi = frame[y1:y2, x1:x2]
    cv2.imwrite("debug_face.jpg", face_roi)

    if face_roi.size == 0:
        return jsonify({
            "emotion": "No face detected"
        }), 200

    # =====================================================
    # Predict emotion
    # =====================================================

    try:

        with _PREDICTION_LOCK:
            raw_emotion, confidence = predict_emotion_with_confidence(face_roi)

        previous_metrics = tracker.get_metrics(student_id)
        previous_state = previous_metrics.get("currentEmotion")
        stability_score = float(previous_metrics.get("stabilityScore", 0.0) or 0.0)
        transition_rate = float(previous_metrics.get("transitionRate", 0.0) or 0.0)
        current_continuous_duration = float(previous_metrics.get("currentContinuousDuration", 0.0) or 0.0)

        student_state = _map_raw_to_student_state(
            raw_emotion,
            confidence=confidence,
            previous_state=previous_state,
            stability_score=stability_score,
            transition_rate=transition_rate,
            current_continuous_duration=current_continuous_duration,
        )

        # =================================================
        # TRACK EMOTION DATA
        # =================================================

        smoothed_state = tracker.update(student_id, student_state)

        analytics = tracker.get_metrics(student_id)
        attention_score = compute_attention_score(
            stability_score=analytics["stabilityScore"],
            transition_rate=analytics["transitionRate"],
            emotion_confidence=confidence,
        )

        # =================================================
        # RETURN RESPONSE
        # =================================================

        print("\n==========================", flush=True)
        print(f"Raw Emotion     : {raw_emotion}", flush=True)
        print(f"Student State   : {student_state}", flush=True)
        print(f"Smoothed State  : {smoothed_state}", flush=True)
        print(f"Confidence      : {confidence:.3f}", flush=True)
        print("==========================\n", flush=True)

        return jsonify({

            # Current student state
            "emotion": smoothed_state or "Unknown",
            "studentState": smoothed_state or "Unknown",
            "rawEmotion": raw_emotion,
            "facialEmotion": raw_emotion,
            "emotionConfidence": round(confidence, 4),
            "attentionScore": attention_score,

            # Analytics
            "emotionDuration": analytics["emotionDuration"],
            "currentContinuousDuration": analytics["currentContinuousDuration"],
            "transitionRate": analytics["transitionRate"],
            "stabilityScore": analytics["stabilityScore"],

            # Engagement Indicators
            "engagementIndicators": analytics["engagementIndicators"],

            # Timeline
            "timeline": analytics["timeline"],

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