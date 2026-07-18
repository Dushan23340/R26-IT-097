from __future__ import annotations

from typing import Optional

from emotion_service.ml.student_state import predict_student_state

LOW_CONFIDENCE_FALLBACK = "Neutral"


def _normalize_emotion(raw_emotion: str) -> str:
    return (raw_emotion or "").strip().lower()


def _calibrate_for_classroom(
    raw_emotion: str,
    confidence: float,
    previous_state: Optional[str] = None,
) -> str:
    """Apply classroom-specific calibration to a facial-expression label
    before mapping. The model's label space is angry/happy/normal - any
    other value is unrecognized and falls back to the previous state.
    """
    normalized = _normalize_emotion(raw_emotion)
    confidence_value = float(confidence or 0.0)

    if normalized == "happy":
        return "happy" if confidence_value >= 0.35 else previous_state or LOW_CONFIDENCE_FALLBACK

    if normalized in {"angry", "normal"}:
        return normalized

    return previous_state or LOW_CONFIDENCE_FALLBACK


def map_raw_to_student_state(
    raw_emotion: str,
    confidence: float,
    previous_state: Optional[str] = None,
    probabilities: Optional[list[float]] = None,
    stability_score: float = 0.0,
    transition_rate: float = 0.0,
    current_continuous_duration: float = 0.0,
) -> str:
    """Map raw facial-expression predictions to student state using the
    student-state decision layer."""
    calibrated_emotion = _calibrate_for_classroom(raw_emotion, confidence, previous_state)

    return predict_student_state(
        facial_emotion=calibrated_emotion,
        emotion_confidence=confidence,
        stability_score=stability_score,
        transition_rate=transition_rate,
        previous_state=previous_state,
        current_continuous_duration=current_continuous_duration,
    )
