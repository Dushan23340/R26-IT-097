"""
Bridges the live-class emotion stream (class_session.py) to IT22197146's
analytics-service (Student Profile Management & Statistical Analytics).

Previously nothing in the platform ever posted to that service's
/emotional-states or /engagement-metrics endpoints - the endpoints existed
and worked (verified this session), but had no caller, so a real student's
emotion-LO correlation analysis always ran on synthetic seed data only.

Best-effort and non-blocking throughout - analytics-service being down
must never affect the live class or the emotion ingest pipeline.
"""

from __future__ import annotations

import os
import threading
import time
from datetime import datetime
from typing import Optional

import requests

ANALYTICS_SERVICE_URL = os.getenv("STUDENT_PROFILE_SERVICE_URL", "http://127.0.0.1:5010")
_TIMEOUT = 3


def _post(path: str, payload: dict) -> Optional[dict]:
    try:
        response = requests.post(f"{ANALYTICS_SERVICE_URL}{path}", json=payload, timeout=_TIMEOUT)
        response.raise_for_status()
        return response.json()
    except requests.RequestException:
        return None


def create_session(student_id: str, subject: Optional[str], student_name: Optional[str] = None) -> Optional[str]:
    """Upserts the student profile then creates one analytics-service
    learning_sessions row representing this student's entire live-class
    attendance - every emotion reading forwarded during the class attaches
    to this same session_id. Called once per student per class (cached by
    class_session_store), not once per reading.

    student_name falls back to student_id only if no real name was ever
    passed - upsert_student's ON CONFLICT DO UPDATE means a later call with
    a real name (e.g. this same student later submitting a quiz) still
    self-heals a student_profiles row created here without one, but this
    should always have a real name available now (the caller already has
    the student's real display name for the Teacher Console roster)."""
    _post("/students", {
        "student_id": student_id,
        "full_name": student_name or student_id,
        "email": f"{student_id}@unknown.local",
        "enrollment_date": datetime.utcnow().date().isoformat(),
        "grade_level": "Grade 9",
    })

    session_response = _post("/sessions", {
        "student_id": student_id,
        "lesson_id": "live-class",
        "lesson_title": subject or "Live Class",
        "start_time": datetime.utcnow().isoformat(),
    })
    if not session_response:
        return None
    return session_response.get("session_id")


def push_emotional_state_async(session_id: str, student_id: str, emotion_label: str, confidence: float) -> None:
    threading.Thread(
        target=_post,
        args=("/emotional-states", {
            "session_id": session_id,
            "student_id": student_id,
            # analytics-service's CHECK constraint expects lowercase
            # (happy/normal/confused/bored/frustrated/angry); this
            # platform's EmotionType enum is uppercase.
            "emotion_label": emotion_label.lower(),
            "confidence": confidence,
        }),
        daemon=True,
    ).start()


def push_engagement_metrics_async(
    session_id: str,
    student_id: str,
    engagement_score: float,
    time_on_task_seconds: float,
    interaction_count: int,
) -> None:
    threading.Thread(
        target=_post,
        args=("/engagement-metrics", {
            "session_id": session_id,
            "student_id": student_id,
            "engagement_score": round(max(0.0, min(1.0, engagement_score)), 4),
            "time_on_task_seconds": max(0, int(time_on_task_seconds)),
            "interaction_count": max(0, int(interaction_count)),
            "quiz_attempts": 0,
        }),
        daemon=True,
    ).start()
