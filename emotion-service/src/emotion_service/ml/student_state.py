from __future__ import annotations

from typing import Optional


def compute_attention_score(
    stability_score: float = 0.0,
    transition_rate: float = 0.0,
    emotion_confidence: float = 0.0,
) -> int:
    """Compute a lightweight attention score from available signals."""
    stability = max(0.0, min(1.0, float(stability_score or 0.0)))
    transition = max(0.0, min(1.0, float(transition_rate or 0.0)))
    confidence = max(0.0, min(1.0, float(emotion_confidence or 0.0)))

    score = (stability * 0.6) + ((1.0 - transition) * 0.3) + (confidence * 0.1)
    return int(max(0, min(100, round(score * 100))))


def predict_student_state(
    facial_emotion: str,
    emotion_confidence: float,
    stability_score: float = 0.0,
    transition_rate: float = 0.0,
    previous_state: Optional[str] = None,
) -> str:
    """Predict classroom learning state from available evidence.

    This layer treats facial emotion as a feature provider, not the final
    learning-state decision.
    """
    normalized = (facial_emotion or "").strip().lower()
    confidence = max(0.0, min(1.0, float(emotion_confidence or 0.0)))
    stability = max(0.0, min(1.0, float(stability_score or 0.0)))
    transition = max(0.0, min(1.0, float(transition_rate or 0.0)))

    if not normalized:
        return previous_state or "Neutral"

    if confidence < 0.35:
        return previous_state or "Neutral"

    # Direct mappings from model's predicted learning states
    if normalized == "bored" and confidence >= 0.5:
        return "Bored"

    if normalized == "confused" and confidence >= 0.5:
        return "Confused"

    if normalized == "frustrated" and confidence >= 0.5:
        return "Frustrated"

    if normalized == "angry" and confidence >= 0.5:
        return "Frustrated"

    # Engagement and neutral state checks
    if normalized in {"happy", "normal", "neutral"}:
        if normalized == "happy" and confidence >= 0.45:
            return "Engaged"

        if confidence >= 0.8:
            return "Engaged"

        if stability >= 0.7 and transition <= 0.25 and confidence >= 0.55:
            return "Engaged"

        return "Neutral"

    return previous_state or "Neutral"

