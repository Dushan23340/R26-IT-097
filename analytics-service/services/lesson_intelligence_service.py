"""Lesson-by-lesson Outcome Intelligence (SO3, FR06).

Every other analysis in this service groups a student's history by session
(chronological order) or by Bloom LO-level - none of them answer "which
LESSONS is this student actually struggling with." This module regroups
the same underlying lo_history/emotional_states/engagement rows by
lesson_id and reuses the existing trend/stability functions on each
lesson's own session subset, rather than reimplementing them.
"""

from __future__ import annotations

from collections import Counter
from statistics import mean
from typing import Any

from services import profile_service, statistics_service

STRONG_THRESHOLD = 75.0  # matches fairness_service.MASTERY_THRESHOLD
# Absolute (not class-relative) variance threshold for flagging a single
# lesson as "high variance" - deliberately simpler than
# statistics_service.compute_class_stability_baseline's class-mean+1.5SD
# approach (used for the whole-profile at-risk flag), since computing a
# class baseline PER LESSON would mean an extra full-class DB scan for
# every lesson a student has ever taken. 15 points of std-dev on a 0-100
# percentile score is a reasonable, documented absolute bar for "unstable".
HIGH_VARIANCE_STD_DEV = 15.0


def _verdict(latest_score: float, trend_direction: str, is_unstable: bool) -> str:
    if latest_score >= STRONG_THRESHOLD and trend_direction != "declining" and not is_unstable:
        return "strength"
    if latest_score < STRONG_THRESHOLD or trend_direction == "declining" or is_unstable:
        return "weakness"
    return "neutral"


def generate_lesson_intelligence(student_id: str) -> list[dict[str, Any]]:
    lo_history = profile_service.get_student_lo_history(student_id)
    emotional_states = profile_service.get_student_emotional_states(student_id)
    engagement = profile_service.get_student_engagement(student_id)

    by_lesson: dict[str, list[dict[str, Any]]] = {}
    for row in lo_history:
        by_lesson.setdefault(row["lesson_id"], []).append(row)

    emotions_by_lesson: dict[str, list[str]] = {}
    for row in emotional_states:
        emotions_by_lesson.setdefault(row["lesson_id"], []).append(row["emotion_label"])

    engagement_by_lesson: dict[str, list[float]] = {}
    for row in engagement:
        engagement_by_lesson.setdefault(row["lesson_id"], []).append(float(row["engagement_score"]))

    results: list[dict[str, Any]] = []
    for lesson_id, rows in by_lesson.items():
        sessions = statistics_service._session_average_scores(rows)
        if not sessions:
            continue

        latest_score = sessions[-1]["avg_score"]
        historical_avg = mean(s["avg_score"] for s in sessions)

        trend = statistics_service.analyze_lo_trend(rows)
        trend_direction = trend["direction"] if trend.get("available") else "insufficient_data"

        stability = statistics_service.compute_stability(rows)
        is_unstable = bool(stability.get("available") and stability["std_dev"] > HIGH_VARIANCE_STD_DEV)

        dominant_emotion = None
        emotions = emotions_by_lesson.get(lesson_id)
        if emotions:
            dominant_emotion = Counter(emotions).most_common(1)[0][0]

        avg_engagement = None
        eng_scores = engagement_by_lesson.get(lesson_id)
        if eng_scores:
            avg_engagement = round(mean(eng_scores), 4)

        results.append({
            "lesson_id": lesson_id,
            "session_count": len(sessions),
            "current_score": round(latest_score, 2),
            "historical_average": round(historical_avg, 2),
            "trend": trend_direction,
            "stability": stability if stability.get("available") else {"available": False},
            "is_unstable": is_unstable,
            "dominant_emotion": dominant_emotion,
            "avg_engagement": avg_engagement,
            "verdict": _verdict(latest_score, trend_direction, is_unstable),
        })

    results.sort(key=lambda r: r["current_score"])
    return results
