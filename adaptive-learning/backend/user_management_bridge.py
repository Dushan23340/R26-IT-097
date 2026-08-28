"""user_management_bridge.py — Notifies backend/'s User Management service
(Node + MongoDB) when a teacher unlocks a lesson's quiz, so students who
completed that lesson's live class and opted into notifications
(User.notificationPreferences.quizUnlocked) get emailed.

Best-effort and non-blocking - the unlock action itself must succeed
regardless of whether User Management is reachable, same reasoning as
analytics_bridge.py/adaptive_learning_bridge.py.
"""

from __future__ import annotations

import os
import threading

import requests

USER_MANAGEMENT_URL = os.environ.get("USER_MANAGEMENT_SERVICE_URL", "http://127.0.0.1:3001")
_TIMEOUT = 3


def _push(student_ids: list[str], lesson_title: str) -> None:
    try:
        requests.post(
            f"{USER_MANAGEMENT_URL}/api/users/notify/quiz-unlocked",
            json={"student_ids": student_ids, "lesson_title": lesson_title},
            timeout=_TIMEOUT,
        )
    except requests.RequestException:
        pass


def notify_quiz_unlocked_async(student_ids: list[str], lesson_title: str) -> None:
    if not student_ids:
        return
    threading.Thread(target=_push, args=(student_ids, lesson_title), daemon=True).start()
