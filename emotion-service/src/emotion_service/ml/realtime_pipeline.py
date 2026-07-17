from __future__ import annotations

from typing import Optional

from emotion_service.ml.student_state import predict_student_state

CONFIDENCE_THRESHOLD = 0.6
HIGH_CONFIDENCE_THRESHOLD = 0.78
MIN_PROBABILITY_GAP = 0.12
LOW_CONFIDENCE_FALLBACK = "Neutral"


def _normalize_emotion(raw_emotion: str) -> str:
    return (raw_emotion or "").strip().lower()


def _is_weak_positive_signal(raw_emotion: str, confidence: float, probabilities: Optional[list[float]] = None) -> bool:
    normalized = _normalize_emotion(raw_emotion)
    if normalized not in {"happy", "neutral", "surprise"}:
        return False

    confidence_value = float(confidence or 0.0)
    if confidence_value < CONFIDENCE_THRESHOLD:
        return True

    if confidence_value < HIGH_CONFIDENCE_THRESHOLD:
        return True

    if probabilities:
        sorted_probs = sorted(probabilities, reverse=True)
        if len(sorted_probs) >= 2 and (sorted_probs[0] - sorted_probs[1]) < MIN_PROBABILITY_GAP:
            return True

    return False


def _calibrate_for_classroom(
    raw_emotion: str,
    confidence: float,
    previous_state: Optional[str] = None,
) -> str:
    """Apply classroom-specific calibration to a FER label before mapping."""
    normalized = _normalize_emotion(raw_emotion)
    confidence_value = float(confidence or 0.0)

    if normalized == "surprise":
        # Surprise in the classroom is usually a sign of engagement or attention.
        if confidence_value >= 0.35:
            return "surprise"
        return previous_state or LOW_CONFIDENCE_FALLBACK

    if normalized == "neutral":
        return "neutral"

    if normalized == "happy":
        return "happy" if confidence_value >= 0.35 else previous_state or LOW_CONFIDENCE_FALLBACK

    if normalized == "sad":
        return "sad" if confidence_value >= 0.5 else previous_state or "sad"

    return normalized


def map_raw_to_student_state(
    raw_emotion: str,
    confidence: float,
    previous_state: Optional[str] = None,
    probabilities: Optional[list[float]] = None,
    stability_score: float = 0.0,
    transition_rate: float = 0.0,
) -> str:
    """Map raw FER predictions to student state using the student-state decision layer."""
    calibrated_emotion = _calibrate_for_classroom(raw_emotion, confidence, previous_state)

    return predict_student_state(
        facial_emotion=calibrated_emotion,
        emotion_confidence=confidence,
        stability_score=stability_score,
        transition_rate=transition_rate,
        previous_state=previous_state,
    )
