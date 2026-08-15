from __future__ import annotations

from typing import Optional

# The fused model (train_fused_model_v3.py) directly classifies
# Angry/Bored/Confused/Frustrated/Happy/Normal, so those five non-"normal"
# labels are trusted directly below when confident enough. "Normal" is the
# one label that stays ambiguous even with the 6-class model: validation
# against DAiSEE-labeled engagement crops (dataset/engagement_eval, see
# scripts/validate_engagement_signatures.py) showed "Normal" dominates
# 56-74% of predictions across every ground-truth engagement label,
# including genuinely Engaged faces - so Bored/Confused/Engaged are still
# inferred behaviorally (duration, stability, transition rate) whenever the
# raw expression is "normal". These thresholds are a starting heuristic -
# tune them against real webcam sessions.
#
# BORED_MIN_DURATION_SECONDS was 20.0 - a real diagnostic session
# (session_logs/session_20260812_202742.csv) showed this was practically
# unreachable: current_continuous_duration resets to ~0 the instant the
# smoothed state changes (emotion_tracker._get_current_continuous_duration
# walks back only to the last state change), and a single Happy/Angry blip
# was enough to trigger that reset via the two thresholds directly below,
# well before 20s of "normal" ever accumulated. Lowered to 10s and the two
# thresholds raised, so brief/ambiguous frames don't derail an otherwise
# building Bored streak.
BORED_MIN_DURATION_SECONDS = 10.0
BORED_MIN_STABILITY = 0.6
# 0.15 -> 0.18: a real session (session_logs/session_20260812_211904_fixed.csv,
# row 15:53:26) hit duration=10.0 and stability=0.708 - both comfortably
# past their thresholds - but transition_rate=0.1667 missed this ceiling by
# just 0.017. 0.15 left near-zero margin for a genuinely calm, low-transition
# stretch to actually register as Bored.
CONFUSED_MIN_TRANSITION_RATE = 0.18
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
    learning-state decision. `facial_emotion` is one of
    angry/bored/confused/frustrated/happy/normal (the fused model's label
    space) - Engaged is always derived here, and Bored/Confused/Engaged are
    additionally re-derived behaviorally (duration, stability, transition
    rate) whenever THIS frame's raw label wasn't confident enough for one of
    the direct classifications above, regardless of what that raw label
    actually was.

    That last part used to be gated on `facial_emotion == "normal"`
    specifically - a real session showed an accumulated 12+ second
    Bored-qualifying streak get silently discarded because the frame that
    would have confirmed it happened to have a raw label of "Angry" at
    0.47 confidence (well under the 0.7 direct-classification bar): the
    old code fell straight through to echoing `previous_state`, never
    reaching the Bored/Confused/Engaged check at all. Duration/stability/
    transition describe the student's behavior over the last window, not
    this one frame - there's no reason a single ambiguous frame's raw
    label should block them from being evaluated.
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
    # classroom setting, regardless of how long it's persisted. Thresholds
    # raised from 0.5/0.45 - at the old values, routine low-confidence
    # blips were enough to instantly flip the state and reset the Bored
    # duration streak (see BORED_MIN_DURATION_SECONDS above).
    if normalized == "angry" and confidence >= 0.7:
        return "Frustrated"

    if normalized == "happy" and confidence >= 0.65:
        return "Engaged"

    # Direct, confident classifications from the fused model's own
    # Bored/Confused/Frustrated classes - trusted as-is rather than
    # re-derived, now that the model can tell them apart itself.
    if normalized == "frustrated" and confidence >= 0.5:
        return "Frustrated"

    if normalized == "confused" and confidence >= 0.45:
        return "Confused"

    if normalized == "bored" and confidence >= 0.45:
        return "Bored"

    # None of the direct classifications above matched - either the raw
    # label really was "normal", or it was something else (angry/happy/...)
    # that didn't clear its own confidence bar. Either way, fall back to
    # the behavioral/temporal signals rather than the raw label - these
    # describe sustained recent behavior, independent of this one frame.

    # Long, unbroken, unchanging flat expression = disengagement.
    if (
        duration >= BORED_MIN_DURATION_SECONDS
        and stability >= BORED_MIN_STABILITY
        and transition <= CONFUSED_MIN_TRANSITION_RATE
    ):
        return "Bored"

    # Frequent flips between states without settling = the student hasn't
    # locked onto a stable reaction, which reads as uncertainty.
    if transition >= CONFUSED_MIN_TRANSITION_RATE and stability < CONFUSED_MAX_STABILITY:
        return "Confused"

    # A consistently-held expression (high stability, low transition) is
    # behaviorally identical whether the student is calmly attentive or
    # holding a negative expression - stability/transition alone can't tell
    # the two apart. Angry has the widest gap between its own direct
    # threshold (0.7) and this branch's confidence floor (0.55): a sub-
    # threshold-confidence Angry reading (0.55-0.70) that fell through
    # every direct check above would otherwise still clear stability/
    # transition/confidence here and get reported as "Engaged" - a student
    # holding a visibly angry/frustrated face showing up as attentive on
    # the dashboard, diagnosed from a real session. Frustrated's own direct
    # threshold (0.5) sits below this branch's 0.55 floor, so it can never
    # actually reach here unconfirmed - listed anyway as a defensive
    # guard in case that threshold changes later. Bored/Confused's raw
    # labels aren't excluded here: an unconfirmed Bored/Confused reading
    # settling into the OTHER behavioral branches (bored/confused) instead
    # of Engaged is still defensible, it's specifically Engaged that's
    # contradictory for a held negative expression.
    if (
        stability >= ENGAGED_MIN_STABILITY
        and transition <= ENGAGED_MAX_TRANSITION_RATE
        and confidence >= 0.55
        and normalized not in {"angry", "frustrated"}
    ):
        return "Engaged"

    # No behavioral signal fired either. A genuine "normal" reading is real
    # information (the model looked at this frame and saw a flat
    # expression) - settle as Neutral. Anything else was an unconfirmed/
    # rejected reading (didn't clear its own confidence bar) - safer to
    # echo the previous state than assert Neutral off a noisy signal.
    return "Neutral" if normalized == "normal" else (previous_state or "Neutral")

