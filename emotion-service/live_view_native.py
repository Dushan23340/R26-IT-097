"""Native, high-FPS live viewer for the REAL, current pipeline - same look
and feel as the old app.py ("Step 1") prototype (cv2.imshow, green box,
label overlay, smooth continuous feed), but wired to the actual production
code path instead of a leftover early-project demo.

app.py (still present) predicts with emotion_model.py -> best_emotion_model.h5,
a separate, older, grayscale, single-branch model - it does not go through
predict_emotion_with_confidence's face-validity gate (occlusion/looking-away
rejection), does not use emotion_tracker's smoothing/duration/stability, and
does not use student_state's Bored/Confused/Engaged behavioral derivation.
None of this session's fixes are visible if you run it - it's an unrelated,
much simpler prototype that happens to share the same cv2.imshow look.

This script instead calls the exact same functions flask_api.py's /predict
route calls (fused_emotion_model.predict_emotion_with_confidence,
emotion_tracker.EmotionTracker, realtime_pipeline.map_raw_to_student_state),
just fed directly from a local webcam frame instead of a browser's
base64-encoded POST body - so what you see here is genuinely the same
decision pipeline the live app uses.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

import cv2

_SERVICE_DIR = Path(__file__).resolve().parent
_SRC_DIR = _SERVICE_DIR / "src"
if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))

from emotion_service.ml.face_detection import detect_faces
from emotion_service.ml.fused_emotion_model import predict_emotion_with_confidence, FaceValidityError
from emotion_service.ml.emotion_tracker import EmotionTracker
from emotion_service.ml.realtime_pipeline import map_raw_to_student_state

WINDOW_TITLE = "Live Emotion Detection - real pipeline (fused model)"
STUDENT_ID = "local_webcam"

# Matches EmotionDetector.jsx's intervalMs=2500 exactly - a real browser
# session only captures+predicts once every 2.5s, so emotion_tracker.py's
# smoothing (5-frame majority vote, HIGH_CONFIDENCE_BYPASS, grace period,
# BORED_MIN_DURATION_SECONDS=10s) was tuned assuming ~12.5s of real time
# across that 5-frame window. Predicting on every captured frame instead
# (24-30fps) fills that same 5-frame window in ~0.2s, turning "smoothing
# over several seconds of behavior" into "smoothing over a fifth of a
# second" - the on-screen label flickers/jumps chaotically as a result,
# not because the model is wrong, but because the cadence assumption the
# whole tracker is built on was broken. Throttling to the same interval
# makes this genuinely match what a real session looks like.
PREDICT_INTERVAL_SECONDS = 2.5

REASON_LABELS = {
    "no_face_detected": "No Face Detected",
    "no_landmarks": "Face Occluded",
    "looking_away": "Looking Away",
}


def expand_face_box(x_val, y_val, w_val, h_val, frame_shape, margin: float = 0.18):
    """Same expansion flask_api.py's /predict route uses, so the crop fed
    to the model matches the live app exactly."""
    height, width = frame_shape[:2]
    dx = int(w_val * margin)
    dy = int(h_val * margin)
    x1 = max(0, x_val - dx)
    y1 = max(0, y_val - dy)
    x2 = min(width, x_val + w_val + dx)
    y2 = min(height, y_val + h_val + dy)
    return x1, y1, x2, y2


def draw_label(frame, x, y, lines: list[str], color) -> None:
    y_cursor = max(y - 12, 14)
    for line in reversed(lines):
        cv2.putText(frame, line, (x, y_cursor), cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2, cv2.LINE_AA)
        y_cursor -= 20


def main() -> int:
    webcam = cv2.VideoCapture(0)
    if not webcam.isOpened():
        print("Error: webcam not available. Please connect a camera and try again.")
        return 1

    webcam.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    webcam.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    webcam.set(cv2.CAP_PROP_FPS, 30)

    tracker = EmotionTracker()
    previous_time = time.time()
    last_predict_time = 0.0

    # Persisted between prediction cycles so the overlay stays visible on
    # every rendered frame (smooth video) while only actually changing once
    # per PREDICT_INTERVAL_SECONDS - exactly like a real dashboard showing
    # the last known reading while waiting for the next poll.
    last_box = None  # (x1, y1, x2, y2)
    last_box_color = (128, 128, 128)
    last_label_lines = ["Waiting for first prediction..."]

    print(f"Live viewer running (predicting every {PREDICT_INTERVAL_SECONDS}s, matching a real "
          "session's poll interval) - press 'q' in the window to quit.")

    try:
        while True:
            ok, frame = webcam.read()
            if not ok:
                print("Warning: failed to read frame from webcam.")
                break

            current_time = time.time()
            if current_time - last_predict_time >= PREDICT_INTERVAL_SECONDS:
                last_predict_time = current_time

                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                faces = detect_faces(frame, gray_frame=gray)

                if len(faces) == 0:
                    tracker.mark_invalid(STUDENT_ID, "no_face_detected")
                    last_box = None
                    last_box_color = (0, 0, 255)
                    last_label_lines = ["No Face Detected"]
                else:
                    x, y, w, h = faces[0]
                    x1, y1, x2, y2 = expand_face_box(x, y, w, h, frame.shape, margin=0.18)
                    face_roi = frame[y1:y2, x1:x2]

                    if face_roi.size == 0:
                        tracker.mark_invalid(STUDENT_ID, "no_face_detected")
                        last_box = None
                        last_box_color = (0, 0, 255)
                        last_label_lines = ["No Face Detected"]
                    else:
                        last_box = (x1, y1, x2, y2)
                        try:
                            raw_emotion, confidence = predict_emotion_with_confidence(face_roi)
                        except FaceValidityError as validity_exc:
                            tracker.mark_invalid(STUDENT_ID, validity_exc.reason)
                            last_box_color = (0, 0, 255)
                            last_label_lines = [REASON_LABELS.get(validity_exc.reason, "Face Not Detected")]
                        except RuntimeError as exc:
                            print(f"Warning: {exc}")
                        else:
                            # Same wiring as flask_api.py's /predict route: raw-signal-based
                            # metrics feed the decision, tracker.update() records the frame.
                            previous_metrics = tracker.get_metrics(STUDENT_ID)
                            previous_state = previous_metrics.get("currentEmotion")
                            stability_score = float(previous_metrics.get("rawStabilityScore", 0.0) or 0.0)
                            transition_rate = float(previous_metrics.get("rawTransitionRate", 0.0) or 0.0)
                            current_continuous_duration = float(
                                previous_metrics.get("rawContinuousDuration", 0.0) or 0.0
                            )

                            student_state = map_raw_to_student_state(
                                raw_emotion,
                                confidence=confidence,
                                previous_state=previous_state,
                                stability_score=stability_score,
                                transition_rate=transition_rate,
                                current_continuous_duration=current_continuous_duration,
                            )
                            smoothed_state = tracker.update(
                                STUDENT_ID, student_state, confidence=confidence, raw_emotion=raw_emotion
                            )

                            last_box_color = (0, 255, 0)
                            last_label_lines = [
                                f"raw: {raw_emotion} ({confidence:.2f})",
                                f"state: {student_state}",
                                f"smoothed: {smoothed_state}",
                            ]

            if last_box is not None:
                x1, y1, x2, y2 = last_box
                cv2.rectangle(frame, (x1, y1), (x2, y2), last_box_color, 2)
                draw_label(frame, x1, y1, last_label_lines, last_box_color)
            else:
                cv2.putText(
                    frame, last_label_lines[0], (10, 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, last_box_color, 2, cv2.LINE_AA,
                )

            delta = max(current_time - previous_time, 1e-6)
            fps = 1.0 / delta
            previous_time = current_time
            cv2.putText(
                frame, f"FPS: {fps:.1f}  (predicting every {PREDICT_INTERVAL_SECONDS}s)",
                (10, frame.shape[0] - 15),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2, cv2.LINE_AA,
            )

            cv2.imshow(WINDOW_TITLE, frame)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    finally:
        webcam.release()
        cv2.destroyAllWindows()

    return 0


if __name__ == "__main__":
    sys.exit(main())
