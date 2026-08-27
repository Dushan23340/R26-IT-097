from __future__ import annotations

import base64
import csv
import logging
import os
import sys
import threading
import time
import traceback
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).resolve().parent / ".env")

import cv2
import numpy as np
import requests
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
from emotion_service.ml.fused_emotion_model import (
    MODEL_PATH,
    predict_emotion_with_confidence,
    extract_debug_face_metrics,
    FaceValidityError,
)
from emotion_service.ml.emotion_tracker import EmotionTracker
from emotion_service.ml.realtime_pipeline import map_raw_to_student_state
from emotion_service.ml.student_state import compute_attention_score
from emotion_service.anonymize import anonymize_student_id

# =========================================================
# APP SETUP
# =========================================================

app = Flask(__name__)

CORS(app, resources={r"/*": {"origins": "*"}})  # type: ignore

app.logger.setLevel(logging.INFO)

tracker = EmotionTracker()

# =========================================================
# LIVE FRAME VIEWER (diagnostic only - lets a human watch the actual
# face crop + prediction for a real session as it happens, not just the
# end-user dashboard's final emoji or the post-hoc CSV/frame-dump files).
# Always on (unlike EMOTION_SESSION_LOG_CSV/EMOTION_FRAME_DUMP_DIR) since
# it's in-memory only - keeps just the single most recent frame per
# student, no disk writes, negligible overhead.
# =========================================================
_LIVE_FRAME_LOCK = threading.Lock()
_LIVE_FRAMES: dict[str, dict] = {}


def _update_live_frame(student_id: str, face_bgr, **fields) -> None:
    try:
        ok, buf = cv2.imencode(".jpg", face_bgr)
        image_b64 = base64.b64encode(buf.tobytes()).decode() if ok else None
    except Exception:
        image_b64 = None
    with _LIVE_FRAME_LOCK:
        _LIVE_FRAMES[student_id] = {
            "timestamp": datetime.utcnow().isoformat(),
            "image_b64": image_b64,
            **fields,
        }


# Human-readable labels for FaceValidityError.reason (and the plain
# zero-detections case, which shares the same "no_face_detected" reason
# string) - shown to the teacher dashboard instead of a stale last-known
# emotion (see emotion_tracker.mark_invalid).
REASON_LABELS = {
    "no_face_detected": "No Face Detected",
    "no_landmarks": "Face Occluded",
    "looking_away": "Looking Away",
}

# Prevent TensorFlow concurrent prediction issues
_PREDICTION_LOCK = threading.Lock()

# =========================================================
# OPT-IN PER-FRAME SESSION LOGGING (for diagnosing sticky-state /
# threshold / duration bugs in the emotion state machine - nothing writes
# to disk unless EMOTION_SESSION_LOG_CSV is set, so default behavior is
# unchanged). Captures every stage of one frame's journey - the raw model
# label+confidence, the per-instant student_state before smoothing, and
# the tracker's smoothed output - in one row, so a real session can be
# replayed and the exact point where it "sticks" is visible column by
# column rather than guessed at.
_SESSION_LOG_PATH = os.environ.get("EMOTION_SESSION_LOG_CSV")
_SESSION_LOG_LOCK = threading.Lock()
_SESSION_LOG_HEADER = [
    "timestamp", "student_id", "raw_emotion", "confidence",
    "student_state", "smoothed_state", "stability_score",
    "transition_rate", "current_continuous_duration",
]


def _log_session_row(**fields) -> None:
    if not _SESSION_LOG_PATH:
        return
    try:
        with _SESSION_LOG_LOCK:
            path = Path(_SESSION_LOG_PATH)
            is_new = not path.exists() or path.stat().st_size == 0
            with path.open("a", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=_SESSION_LOG_HEADER)
                if is_new:
                    writer.writeheader()
                writer.writerow(fields)
    except OSError:
        pass  # best-effort - a logging failure must never break a live prediction


def _log_invalid_session_row(student_id: str, reason: str) -> None:
    """Logs a row for a rejected frame (occluded/looking away/no face at
    all), instead of just skipping it. Before this, an invalid frame wrote
    nothing at all, so a session log had a silent timestamp gap for however
    long the face was unreadable - indistinguishable from "the poll simply
    didn't happen" and impossible to replay/diagnose. raw_emotion carries
    the rejection reason as a sentinel (never a real model label) so replay
    tooling can tell the two apart at a glance."""
    _log_session_row(
        timestamp=datetime.utcnow().isoformat(),
        student_id=student_id,
        raw_emotion=reason,
        confidence=0.0,
        student_state="NoFace",
        smoothed_state="NoFace",
        stability_score=0.0,
        transition_rate=0.0,
        current_continuous_duration=0.0,
    )


# =========================================================
# OPT-IN FRAME DUMP (diagnostic only, never on by default). Saves the
# exact face crop the model saw plus its full 6-class probability
# breakdown and named blendshape/head-pose readings - session CSV rows
# only carry the winning label+confidence, which isn't enough to tell
# "the model was 51% Normal, 48% Bored" apart from "the model was 98%
# confident Normal was right", or to confirm whether e.g. eyeBlink
# blendshapes actually registered as closed for a specific frame.
# =========================================================
_FRAME_DUMP_DIR = os.environ.get("EMOTION_FRAME_DUMP_DIR")
_FRAME_DUMP_LOCK = threading.Lock()
_FRAME_DUMP_MANIFEST_HEADER = [
    "timestamp", "student_id", "image_file", "top_label", "confidence",
    "prob_Angry", "prob_Bored", "prob_Confused", "prob_Frustrated", "prob_Happy", "prob_Normal",
    "detected", "pitchDeg", "yawDeg", "rollDeg", "eyeBlinkLeft", "eyeBlinkRight",
    "eyeSquintLeft", "eyeSquintRight",
]


def _dump_debug_frame(face_roi, student_id: str, top_label: str, confidence: float, probabilities: dict) -> None:
    if not _FRAME_DUMP_DIR:
        return
    try:
        dump_dir = Path(_FRAME_DUMP_DIR)
        dump_dir.mkdir(parents=True, exist_ok=True)

        ts = datetime.utcnow()
        stamp = ts.strftime("%Y%m%dT%H%M%S_%f")
        image_file = f"{stamp}_{student_id}.jpg"

        cv2.imwrite(str(dump_dir / image_file), face_roi)

        debug_metrics = extract_debug_face_metrics(face_roi)

        row = {
            "timestamp": ts.isoformat(),
            "student_id": student_id,
            "image_file": image_file,
            "top_label": top_label,
            "confidence": round(confidence, 4),
            **{f"prob_{label}": probabilities.get(label) for label in
               ("Angry", "Bored", "Confused", "Frustrated", "Happy", "Normal")},
            "detected": debug_metrics.get("detected"),
            "pitchDeg": debug_metrics.get("pitchDeg"),
            "yawDeg": debug_metrics.get("yawDeg"),
            "rollDeg": debug_metrics.get("rollDeg"),
            "eyeBlinkLeft": debug_metrics.get("eyeBlinkLeft"),
            "eyeBlinkRight": debug_metrics.get("eyeBlinkRight"),
            "eyeSquintLeft": debug_metrics.get("eyeSquintLeft"),
            "eyeSquintRight": debug_metrics.get("eyeSquintRight"),
        }

        with _FRAME_DUMP_LOCK:
            manifest_path = dump_dir / "manifest.csv"
            is_new = not manifest_path.exists() or manifest_path.stat().st_size == 0
            with manifest_path.open("a", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=_FRAME_DUMP_MANIFEST_HEADER)
                if is_new:
                    writer.writeheader()
                writer.writerow(row)
    except OSError:
        pass  # best-effort - a dump failure must never break a live prediction


# =========================================================
# ANALYTICS SERVICE FORWARDING (component IT22242754)
# =========================================================
# emotion-backend (the class-level analytics + game-recommendation service)
# was built around the original shared vocabulary (Happy/Normal/Confused/
# Bored/Frustrated/Angry as sibling states) that predates this service's
# Phase 4 redesign, which now derives Bored/Confused/Frustrated/Engaged/
# Neutral downstream instead of predicting them directly. This maps our
# smoothed student state back onto that shared vocabulary for forwarding.

ANALYTICS_SERVICE_URL = os.getenv("ANALYTICS_SERVICE_URL", "http://127.0.0.1:8000")

_STATE_TO_ANALYTICS_EMOTION = {
    "bored": "BORED",
    "confused": "CONFUSED",
    "frustrated": "FRUSTRATED",
    "engaged": "HAPPY",
    "neutral": "NORMAL",
}


def _forward_to_analytics_service(student_id: str, smoothed_state: str, confidence: float) -> None:
    """Best-effort forward to the class-level analytics service. Never
    raises - the analytics service being down or unreachable must not
    affect this service's own /predict response."""
    emotion_code = _STATE_TO_ANALYTICS_EMOTION.get((smoothed_state or "").strip().lower())
    if emotion_code is None:
        return

    try:
        requests.post(
            f"{ANALYTICS_SERVICE_URL}/emotions",
            json={
                "student_id": str(student_id),
                "emotion": emotion_code,
                "confidence": float(confidence),
            },
            timeout=2,
        )
    except requests.RequestException:
        pass


def _forward_invalid_to_analytics_service(student_id: str, reason: str) -> None:
    """Best-effort forward of a rejected frame (occluded/looking away/no
    face) to the class-level analytics service, so its Class Emotion
    Overview stops showing this student's stale last-known emotion while
    their camera can't actually be read. Deliberately hits a separate,
    lighter /emotions/invalid endpoint rather than the main /emotions
    ingest route - that route also bridges into the student-profile
    analytics service as a real recorded emotional state, which a rejected
    frame must never do (see emotion_store.mark_invalid's docstring)."""
    try:
        requests.post(
            f"{ANALYTICS_SERVICE_URL}/emotions/invalid",
            json={"student_id": str(student_id), "reason": reason},
            timeout=2,
        )
    except requests.RequestException:
        pass


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
            "analyticsWindowSeconds": metrics.get("analyticsWindowSeconds"),
            "lastSeenTimestamp": metrics.get("lastSeenTimestamp"),
            "faceDetected": metrics.get("faceDetected", True),
            "invalidReason": metrics.get("invalidReason"),
        }
        for student_id, metrics in all_students.items()
    ]

    return jsonify({"students": results, "count": len(results)}), 200


@app.route("/live", methods=["GET"])
def live_frames():
    """Diagnostic: the single most recent processed frame (face crop as a
    base64 JPEG) + prediction for every student currently being tracked -
    lets a human literally watch the face->emotion pipeline during a real
    session, distinct from both the end-user dashboard (only shows the
    final smoothed emoji) and EMOTION_FRAME_DUMP_DIR (writes every frame
    to disk, opt-in, not a live view). In-memory only, always on."""
    with _LIVE_FRAME_LOCK:
        return jsonify({"students": dict(_LIVE_FRAMES)}), 200


@app.route("/live/<student_id>", methods=["GET"])
def live_frame_for_student(student_id: str):
    with _LIVE_FRAME_LOCK:
        frame = _LIVE_FRAMES.get(anonymize_student_id(student_id)) or _LIVE_FRAMES.get(student_id)
    if frame is None:
        return jsonify({"error": "No frames processed yet for this student"}), 404
    return jsonify(frame), 200


@app.route("/predict", methods=["POST"])
def predict():

    payload = request.get_json(silent=True) or {}

    image_b64 = payload.get("image")

    # FR10: real student_id is anonymised immediately on entry - everything
    # downstream (tracker keys, /students responses, forwarded events) uses
    # only the pseudonym from here on, never the raw ID/email this request
    # arrived with.
    student_id = anonymize_student_id(payload.get("studentId", "default_student"))

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
        tracker.mark_invalid(student_id, "no_face_detected")
        _log_invalid_session_row(student_id, "no_face_detected")
        _update_live_frame(
            student_id, frame,
            rawEmotion=None, confidence=None, smoothedState=None,
            faceDetected=False, invalidReason="no_face_detected",
        )
        threading.Thread(
            target=_forward_invalid_to_analytics_service,
            args=(student_id, "no_face_detected"),
            daemon=True,
        ).start()
        return jsonify({
            "emotion": REASON_LABELS["no_face_detected"],
            "faceDetected": False,
            "invalidReason": "no_face_detected",
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
        tracker.mark_invalid(student_id, "no_face_detected")
        _log_invalid_session_row(student_id, "no_face_detected")
        _update_live_frame(
            student_id, frame,
            rawEmotion=None, confidence=None, smoothedState=None,
            faceDetected=False, invalidReason="no_face_detected",
        )
        threading.Thread(
            target=_forward_invalid_to_analytics_service,
            args=(student_id, "no_face_detected"),
            daemon=True,
        ).start()
        return jsonify({
            "emotion": REASON_LABELS["no_face_detected"],
            "faceDetected": False,
            "invalidReason": "no_face_detected",
        }), 200

    # Fused model uses the color crop directly (image branch + MediaPipe
    # landmark/blendshape branch both need real color+resolution, unlike
    # the old grayscale-only pipeline).
    face_roi = frame[y1:y2, x1:x2]

    if face_roi.size == 0:
        tracker.mark_invalid(student_id, "no_face_detected")
        _log_invalid_session_row(student_id, "no_face_detected")
        _update_live_frame(
            student_id, frame,
            rawEmotion=None, confidence=None, smoothedState=None,
            faceDetected=False, invalidReason="no_face_detected",
        )
        threading.Thread(
            target=_forward_invalid_to_analytics_service,
            args=(student_id, "no_face_detected"),
            daemon=True,
        ).start()
        return jsonify({
            "emotion": REASON_LABELS["no_face_detected"],
            "faceDetected": False,
            "invalidReason": "no_face_detected",
        }), 200

    # =====================================================
    # Predict emotion
    # =====================================================

    try:

        try:
            with _PREDICTION_LOCK:
                # return_probabilities costs nothing extra (the fused model
                # already computes the full softmax either way - see
                # predict_emotion_with_confidence's docstring), so always
                # request it now instead of gating it behind
                # EMOTION_FRAME_DUMP_DIR - the per-class breakdown is part of
                # the documented response schema, not a debug-only extra.
                raw_emotion, confidence, probabilities = predict_emotion_with_confidence(
                    face_roi, return_probabilities=True
                )
                if _FRAME_DUMP_DIR:
                    _dump_debug_frame(face_roi, student_id, raw_emotion, confidence, probabilities)
        except FaceValidityError as validity_exc:
            tracker.mark_invalid(student_id, validity_exc.reason)
            _log_invalid_session_row(student_id, validity_exc.reason)
            _update_live_frame(
                student_id, face_roi,
                rawEmotion=None, confidence=None, smoothedState=None,
                faceDetected=False, invalidReason=validity_exc.reason,
            )
            threading.Thread(
                target=_forward_invalid_to_analytics_service,
                args=(student_id, validity_exc.reason),
                daemon=True,
            ).start()
            print(f"Face validity gate rejected frame: {validity_exc.reason}", flush=True)
            return jsonify({
                "emotion": REASON_LABELS.get(validity_exc.reason, "Face Not Detected"),
                "faceDetected": False,
                "invalidReason": validity_exc.reason,
            }), 200

        previous_metrics = tracker.get_metrics(student_id)
        previous_state = previous_metrics.get("currentEmotion")
        # Raw-signal-based (see emotion_tracker.py's "Raw-signal-based
        # variants" section), not the derived-state stabilityScore/
        # transitionRate/currentContinuousDuration - those describe the
        # tracker's own past OUTPUT, which used to feed straight back into
        # this same decision and could self-reinforce an oscillation (a
        # single anomalous raw reading, or a stable raw signal alternating
        # between two derived labels, could keep transition_rate elevated
        # indefinitely regardless of how consistent the actual facial
        # signal was). These read the fused model's own label history
        # instead, which isn't affected by what predict_student_state()
        # has decided on past frames.
        stability_score = float(previous_metrics.get("rawStabilityScore", 0.0) or 0.0)
        transition_rate = float(previous_metrics.get("rawTransitionRate", 0.0) or 0.0)
        current_continuous_duration = float(previous_metrics.get("rawContinuousDuration", 0.0) or 0.0)

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

        smoothed_state = tracker.update(
            student_id, student_state, confidence=confidence, raw_emotion=raw_emotion
        )

        _update_live_frame(
            student_id, face_roi,
            rawEmotion=raw_emotion, confidence=round(confidence, 4),
            studentState=student_state, smoothedState=smoothed_state,
            faceDetected=True, invalidReason=None,
        )

        threading.Thread(
            target=_forward_to_analytics_service,
            args=(student_id, smoothed_state, confidence),
            daemon=True,
        ).start()

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

        # Deliberately logging the PRE-update (previous_metrics) stability/
        # transition/duration here, not analytics' post-update snapshot -
        # those are the actual values passed into _map_raw_to_student_state
        # above, i.e. what really justified `student_state` on this row. The
        # post-update analytics reflect a DIFFERENT moment (after this
        # frame's own classification has already been folded into the
        # window), which can look inconsistent with the decision it's sitting
        # next to - e.g. a stability of 0.6 next to a Neutral->Engaged flip
        # looks like a bug (transition/stability thresholds unmet) until you
        # realize the real decision-time stability was 0.75. Diagnosed by
        # replaying a real session where every Normal->Engaged row showed
        # this exact mismatch.
        _log_session_row(
            timestamp=datetime.utcnow().isoformat(),
            student_id=student_id,
            raw_emotion=raw_emotion,
            confidence=round(confidence, 4),
            student_state=student_state,
            smoothed_state=smoothed_state,
            stability_score=stability_score,
            transition_rate=transition_rate,
            current_continuous_duration=current_continuous_duration,
        )

        return jsonify({

            # Current student state
            "studentId": student_id,  # anonymized pseudonym, never the raw ID this request arrived with (FR10)
            "timestamp": datetime.utcnow().isoformat(),
            "emotion": smoothed_state or "Unknown",
            "studentState": smoothed_state or "Unknown",
            "rawEmotion": raw_emotion,
            "facialEmotion": raw_emotion,
            "emotionConfidence": round(confidence, 4),
            "emotionProbabilities": probabilities,
            "attentionScore": attention_score,

            # Analytics - all computed over the trailing analyticsWindowSeconds
            # window (configurable via EMOTION_ANALYTICS_WINDOW_SECONDS), not
            # the whole session - see emotion_tracker.py's _trim_to_window.
            "emotionDuration": analytics["emotionDuration"],
            "currentContinuousDuration": analytics["currentContinuousDuration"],
            "transitionRate": analytics["transitionRate"],
            "stabilityScore": analytics["stabilityScore"],
            "analyticsWindowSeconds": analytics["analyticsWindowSeconds"],

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