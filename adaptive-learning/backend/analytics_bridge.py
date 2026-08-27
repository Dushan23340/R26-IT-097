"""
analytics_bridge.py — Pushes real lesson-quiz outcomes into IT22197146's
analytics-service (Student Profile Management & Statistical Analytics) so
her statistical engine has real LO-score data to compute trends/stability/
correlations over, instead of only synthetic seed data.

Best-effort and non-blocking - analytics-service being down must never
break a student's quiz submission.
"""

from __future__ import annotations

import os
import threading
from datetime import datetime, timedelta

import requests

from anonymize import anonymize_student_id

ANALYTICS_SERVICE_URL = os.environ.get("STUDENT_PROFILE_SERVICE_URL", "http://127.0.0.1:5010")
# emotion-service (IT22140784) - real-time per-student emotion tracker.
# Queried best-effort at quiz-submission time so the Sentence-BERT
# recommendation engine's emotion bias (semantic_recommender.EMOTION_BIAS)
# actually has live data to act on, instead of always receiving emotion=None
# because no frontend page ever sent one.
EMOTION_SERVICE_URL = os.environ.get("EMOTION_SERVICE_URL", "http://127.0.0.1:5002")
_TIMEOUT = 3


def _post(path: str, payload: dict) -> dict | None:
    try:
        response = requests.post(f"{ANALYTICS_SERVICE_URL}{path}", json=payload, timeout=_TIMEOUT)
        response.raise_for_status()
        return response.json()
    except requests.RequestException:
        return None


def _get(path: str) -> dict | None:
    try:
        response = requests.get(f"{ANALYTICS_SERVICE_URL}{path}", timeout=_TIMEOUT)
        response.raise_for_status()
        return response.json()
    except requests.RequestException:
        return None


MASTERY_THRESHOLD = 75.0  # mastery.py no longer uses a numeric threshold (raw-count
# good/average/weak tiers instead), but 75% still cleanly separates "good" (100%,
# i.e. 3/3 correct) from "average"/"weak" (<=66.7%) for this function's purpose


# All 6 emotion-service tracker states map through - EMOTION_BIAS and
# validated_recommendations.py's (lesson x emotion) table both cover the
# full set (happy/normal/confused/bored/frustrated/angry), unlike the
# earlier 3-state subset this used to be restricted to.
_TRACKER_STATE_TO_BIAS_KEY = {
    "happy": "happy",
    "normal": "normal",
    "confused": "confused",
    "bored": "bored",
    "frustrated": "frustrated",
    "angry": "angry",
}


def get_live_emotion(student_id: str) -> str | None:
    """Best-effort lookup of this student's current tracked emotion from
    emotion-service's in-memory tracker (GET /students) - only returns a
    value if that student has actually been seen recently (e.g. currently
    or recently in a live class with their webcam on); returns None
    otherwise, same as if no emotion had been detected at all.

    emotion-service anonymises student_id (FR10) before ever storing or
    returning it, so this student_id must be hashed the same way before
    comparing - matching against the raw ID would never match anything."""
    pseudonym = anonymize_student_id(student_id)
    try:
        response = requests.get(f"{EMOTION_SERVICE_URL}/students", timeout=_TIMEOUT)
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException:
        return None

    for student in payload.get("students", []):
        if str(student.get("studentId")) == pseudonym:
            current = str(student.get("currentEmotion") or "").strip().lower()
            return _TRACKER_STATE_TO_BIAS_KEY.get(current)
    return None


def get_class_dominant_emotion(student_id: str) -> str | None:
    """Synchronous, best-effort lookup of the emotion that occurred most
    often during this student's most recent LIVE CLASS session (not their
    instantaneous state - see get_live_emotion above, which this
    supersedes as the primary emotion signal for quiz recommendations,
    falling back to get_live_emotion only if this student has never been
    in a tracked live class). analytics-service's emotional_states.emotion_label
    is lowercase-DB-enforced already, but this normalizes defensively since
    that isn't a contract this file controls."""
    result = _get(f"/students/{student_id}/analytics/latest-class-emotion")
    if not result or not result.get("dominant_emotion"):
        return None
    return str(result["dominant_emotion"]).strip().lower()


def get_latest_weak_los(student_id: str) -> dict | None:
    """Synchronous (unlike push_quiz_result_async) - called directly from a
    GET request handler, not fire-and-forget. Looks up this student's most
    recent lesson session in analytics-service and returns any LOs still
    below mastery for it, so the dashboard can show real "recommended for
    you" resources without requiring a fresh quiz submission first."""
    history = _get(f"/students/{student_id}/history")
    if not history or not history.get("lo_history"):
        return None

    lo_history = history["lo_history"]
    latest_session_id = max(lo_history, key=lambda row: row["start_time"])["session_id"]
    latest_lesson_id = next(row["lesson_id"] for row in lo_history if row["session_id"] == latest_session_id)

    weak_los = [
        row["lo_level"]
        for row in lo_history
        if row["session_id"] == latest_session_id and float(row["score"]) < MASTERY_THRESHOLD
    ]
    if not weak_los:
        return None

    return {"lesson_id": latest_lesson_id, "weak_los": weak_los}


def _push(
    student_id: str,
    student_name: str,
    student_email: str,
    lesson_id: str,
    lesson_title: str,
    mastery_result: dict,
    answered_count: int = 0,
    total_questions: int = 0,
    duration_seconds: int | None = None,
    difficulty: str | None = None,
) -> None:
    # learning_sessions.student_id is a foreign key into student_profiles -
    # a real logged-in student has never had a profile row created for
    # them, so every session insert below used to fail silently (analytics
    # never actually recorded a single real student). Upsert first so the
    # FK is satisfied; enrollment_date/grade_level aren't tracked anywhere
    # upstream yet, so default them rather than leaving the field NULL
    # (the column is NOT NULL).
    _post("/students", {
        "student_id": student_id,
        "full_name": student_name or student_id,
        "email": student_email or f"{student_id}@unknown.local",
        "enrollment_date": datetime.utcnow().date().isoformat(),
        "grade_level": "Grade 9",
    })

    # duration_seconds is the real, frontend-measured quiz-taking time
    # (lessons.jsx tracks it from quiz-screen mount to submit). Fall back to
    # a placeholder 5-minute window only when it's missing (e.g. an older
    # client), since learning_sessions.duration_seconds otherwise stays
    # accurate for real submissions.
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(seconds=duration_seconds if duration_seconds else 300)

    session_response = _post("/sessions", {
        "student_id": student_id,
        "lesson_id": lesson_id,
        "lesson_title": lesson_title,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "difficulty": difficulty,
    })
    if not session_response:
        return

    session_id = session_response.get("session_id")
    if not session_id:
        return

    for lo_level, lo_data in mastery_result.get("lo_scores", {}).items():
        _post("/lo-scores", {
            "session_id": session_id,
            "student_id": student_id,
            "lo_level": lo_level,
            "score": lo_data["percentile_mastery_score"],
            "max_score": 100,
        })

    # Real engagement signal (SO2/proposal FR05): no interaction-tracking
    # exists yet, so answered/total questions is the most honest proxy we
    # actually have for "engagement" during a quiz - not fabricated/random.
    if total_questions > 0 and duration_seconds:
        _post("/engagement-metrics", {
            "session_id": session_id,
            "student_id": student_id,
            "engagement_score": round(min(1.0, answered_count / total_questions), 4),
            "time_on_task_seconds": duration_seconds,
            "interaction_count": answered_count,
            "quiz_attempts": 1,
        })


def push_quiz_result_async(
    student_id: str,
    lesson_id: str,
    lesson_title: str,
    mastery_result: dict,
    student_name: str = "",
    student_email: str = "",
    answered_count: int = 0,
    total_questions: int = 0,
    duration_seconds: int | None = None,
    difficulty: str | None = None,
) -> None:
    threading.Thread(
        target=_push,
        args=(student_id, student_name, student_email, lesson_id, lesson_title, mastery_result),
        kwargs={
            "answered_count": answered_count,
            "total_questions": total_questions,
            "duration_seconds": duration_seconds,
            "difficulty": difficulty,
        },
        daemon=True,
    ).start()
