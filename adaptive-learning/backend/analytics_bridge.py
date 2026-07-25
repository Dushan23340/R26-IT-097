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

ANALYTICS_SERVICE_URL = os.environ.get("STUDENT_PROFILE_SERVICE_URL", "http://127.0.0.1:5010")
_TIMEOUT = 3


def _post(path: str, payload: dict) -> dict | None:
    try:
        response = requests.post(f"{ANALYTICS_SERVICE_URL}{path}", json=payload, timeout=_TIMEOUT)
        response.raise_for_status()
        return response.json()
    except requests.RequestException:
        return None


def _push(
    student_id: str,
    student_name: str,
    student_email: str,
    lesson_id: str,
    lesson_title: str,
    mastery_result: dict,
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

    start_time = datetime.utcnow() - timedelta(minutes=5)
    end_time = datetime.utcnow()

    session_response = _post("/sessions", {
        "student_id": student_id,
        "lesson_id": lesson_id,
        "lesson_title": lesson_title,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
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


def push_quiz_result_async(
    student_id: str,
    lesson_id: str,
    lesson_title: str,
    mastery_result: dict,
    student_name: str = "",
    student_email: str = "",
) -> None:
    threading.Thread(
        target=_push,
        args=(student_id, student_name, student_email, lesson_id, lesson_title, mastery_result),
        daemon=True,
    ).start()
