from __future__ import annotations

from typing import Optional

# The CNN (Phase 2) only classifies facial expression (Angry/Happy/Normal) -
# it never emits Bored/Confused directly. Validation against DAiSEE-labeled
# engagement crops (dataset/engagement_eval, see
# scripts/validate_engagement_signatures.py) showed raw expression alone
# doesn't separate those states: "Normal" dominates 56-74% of predictions
# across every ground-truth engagement label, including genuinely Engaged
# faces. So Bored/Confused are inferred from how long/steady/erratic the
# expression has been (duration, stability, transition rate) rather than
# from which expression is currently showing. These thresholds are a
# starting heuristic - tune them against real webcam sessions.
BORED_MIN_DURATION_SECONDS = 20.0
BORED_MIN_STABILITY = 0.6
CONFUSED_MIN_TRANSITION_RATE = 0.15
CONFUSED_MAX_STABILITY = 0.5
ENGAGED_MIN_STABILITY = 0.7
ENGAGED_MAX_TRANSITION_RATE = 0.25


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
    current_continuous_duration: float = 0.0,
) -> str:
    """Predict classroom learning state from available evidence.

    This layer treats facial emotion as a feature provider, not the final
    learning-state decision. `facial_emotion` is one of angry/happy/normal
    (the CNN's label space) - Bored/Confused/Frustrated/Engaged are all
    derived here, not predicted directly by the model.
    """
    normalized = (facial_emotion or "").strip().lower()
    confidence = max(0.0, min(1.0, float(emotion_confidence or 0.0)))
    stability = max(0.0, min(1.0, float(stability_score or 0.0)))
    transition = max(0.0, min(1.0, float(transition_rate or 0.0)))
    duration = max(0.0, float(current_continuous_duration or 0.0))

    if not normalized:
        return previous_state or "Neutral"

    if confidence < 0.35:
        return previous_state or "Neutral"

    # A confident negative-affect expression reads as frustration in a
    # classroom setting, regardless of how long it's persisted.
    if normalized == "angry" and confidence >= 0.5:
        return "Frustrated"

    if normalized == "happy" and confidence >= 0.45:
        return "Engaged"

    if normalized == "normal":
        # Long, unbroken, unchanging flat expression = disengagement.
        if (
            duration >= BORED_MIN_DURATION_SECONDS
            and stability >= BORED_MIN_STABILITY
            and transition <= CONFUSED_MIN_TRANSITION_RATE
        ):
            return "Bored"

        # Frequent flips between states without settling = the student
        # hasn't locked onto a stable reaction, which reads as uncertainty.
        if transition >= CONFUSED_MIN_TRANSITION_RATE and stability < CONFUSED_MAX_STABILITY:
            return "Confused"

        if (
            stability >= ENGAGED_MIN_STABILITY
            and transition <= ENGAGED_MAX_TRANSITION_RATE
            and confidence >= 0.55
        ):
            return "Engaged"

        return "Neutral"

    return previous_state or "Neutral"

