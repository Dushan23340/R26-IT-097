"""
Bridges the live-class emotion stream (class_session.py) to
IT22186492's adaptive-learning/backend (Learning Outcome & Adaptive
Support), so a live class ending for a real lesson_id marks that lesson
complete for every student who attended, with the real dominant emotion
captured during it - not a decoupled, best-effort inference at quiz-submit
time.

Same shape as student_profile_bridge.py in this same directory: best-effort
and non-blocking, adaptive-learning/backend being down must never break
ending a live class.
"""

from __future__ import annotations

import os
import threading
from typing import Optional

import requests

ADAPTIVE_LEARNING_URL = os.getenv("ADAPTIVE_LEARNING_SERVICE_URL", "http://127.0.0.1:5005")
_TIMEOUT = 3


def _push(lesson_id: str, completions: list[dict]) -> Optional[dict]:
    try:
        response = requests.post(
            f"{ADAPTIVE_LEARNING_URL}/api/lessons/{lesson_id}/complete",
            json={"completions": completions},
            timeout=_TIMEOUT,
        )
        response.raise_for_status()
        return response.json()
    except requests.RequestException:
        return None


def push_lesson_completions_async(lesson_id: str, completions: list[dict]) -> None:
    """completions: [{"student_id": real_id, "dominant_emotion": str | None}, ...]
    for every student who attended this live class. Fire-and-forget, same
    as student_profile_bridge.push_engagement_metrics_async - ending a live
    class must never block on (or fail because of) a sibling service being
    slow or down. No-ops if the list is empty."""
    if not completions:
        return
    threading.Thread(target=_push, args=(lesson_id, completions), daemon=True).start()
