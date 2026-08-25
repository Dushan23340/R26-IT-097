"""Forwards approved/modified recommendations to adaptive-learning/backend
(IT22186492, the Learning Outcome Component) - closes the "forwarded to
Learning Outcome Component for execution" step in the proposal's Figure 3
that previously did nothing after a teacher clicked Approve.

Best-effort and non-blocking, same convention as adaptive-learning's own
analytics_bridge.py: the LO component being down must never break a
teacher's review action in this service.
"""

from __future__ import annotations

import os

import requests

LO_COMPONENT_URL = os.environ.get("LO_COMPONENT_SERVICE_URL", "http://127.0.0.1:5005")
_TIMEOUT = 3


def forward_recommendation(student_id: str, lesson_id: str, recommendation_text: str, insight_type: str) -> bool:
    try:
        response = requests.post(
            f"{LO_COMPONENT_URL}/api/students/{student_id}/advisor-recommendations",
            json={
                "lesson_id": lesson_id,
                "text": recommendation_text,
                "insight_type": insight_type,
                "source": "IT22197146-analytics-service",
            },
            timeout=_TIMEOUT,
        )
        response.raise_for_status()
        return True
    except requests.RequestException:
        return False
