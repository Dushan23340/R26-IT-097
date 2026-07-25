"""Expert-in-the-Loop Validation Workflow (SO5, proposal Figure 3).

Statistically-generated insights never reach a student's learning path
directly - they're written to the `recommendations` table as `pending`,
a teacher/advisor reviews the supporting evidence via the API, and only
`approve`/`modify` decisions become visible to downstream consumers
(the "approved recommendations" a teammate's Learning Outcome component
can poll). `reject` archives the decision with its rationale, matching
the reject path in Figure 3.
"""

from __future__ import annotations

from typing import Any, Optional

from config.database import get_cursor
from services import profile_service, statistics_service

INSIGHT_THRESHOLDS_NOTE = (
    "Recommendations are only generated for findings that clear the "
    "statistical significance/materiality thresholds in statistics_service "
    "(p < 0.05 for trend/engagement, |r| >= 0.3 for correlation, "
    "class-baseline + 1.5 SD for stability) - not every session produces one."
)


def _queue(
    student_id: str,
    insight_type: str,
    recommendation_text: str,
    evidence: dict[str, Any],
    session_id: Optional[str] = None,
) -> int:
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO recommendations (student_id, session_id, insight_type, recommendation_text, statistical_evidence)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (student_id, session_id, insight_type, recommendation_text, _to_jsonb(evidence)),
        )
        return int(cur.fetchone()[0])


def _to_jsonb(evidence: dict[str, Any]):
    import json
    return json.dumps(evidence, default=str)


def analyze_student_and_queue_recommendations(
    student_id: str,
    stability_baseline: Optional[dict[str, Any]] = None,
) -> list[int]:
    """Runs the statistics engine for one student and queues a
    recommendation for each finding that clears significance/materiality.
    Returns the list of newly-created recommendation ids."""
    lo_history = profile_service.get_student_lo_history(student_id)
    emotional_states = profile_service.get_student_emotional_states(student_id)
    engagement = profile_service.get_student_engagement(student_id)

    created: list[int] = []

    trend = statistics_service.analyze_lo_trend(lo_history)
    if trend.get("available") and trend["significant"] and trend["direction"] == "declining":
        text = (
            f"Student {student_id}'s learning-outcome scores show a statistically significant "
            f"declining trend across {trend['session_count']} sessions "
            f"(slope={trend['slope']}, p={trend['p_value']}). Consider a check-in or "
            "targeted review of recent lesson content."
        )
        created.append(_queue(student_id, "trend", text, trend))

    if stability_baseline and stability_baseline.get("available"):
        stability = statistics_service.compute_stability(lo_history)
        if stability.get("available") and statistics_service.is_at_risk_by_stability(
            stability["std_dev"], stability_baseline
        ):
            text = (
                f"Student {student_id}'s scores are unusually volatile across sessions "
                f"(std_dev={stability['std_dev']}, class at-risk threshold={stability_baseline['at_risk_threshold']}). "
                "High variance in performance is a stronger dropout/disengagement predictor than low "
                "average performance alone - recommend individual follow-up."
            )
            created.append(_queue(student_id, "stability", text, {**stability, "baseline": stability_baseline}))

    correlations = statistics_service.analyze_emotion_lo_correlation(lo_history, emotional_states)
    for emotion, result in correlations.items():
        if result.get("available") and result["meaningful"] and result["direction"] == "negative":
            text = (
                f"Student {student_id}'s sessions with higher {emotion} show significantly lower LO scores "
                f"(r={result['r']}, p={result['p_value']}, n={result['n']}). Consider addressing {emotion.lower()} "
                "triggers directly (pacing, content difficulty, or a check-in)."
            )
            created.append(_queue(student_id, "emotion_correlation", text, {emotion: result}))

    engagement_result = statistics_service.analyze_engagement_performance(lo_history, engagement)
    if engagement_result.get("available") and engagement_result["significant"] and (
        engagement_result["high_median"] > engagement_result["low_median"]
    ):
        text = (
            f"Student {student_id} scores significantly higher in high-engagement sessions "
            f"(median {engagement_result['high_median']}) than low-engagement ones "
            f"(median {engagement_result['low_median']}, p={engagement_result['p_value']}). "
            "Engagement-boosting interventions (e.g. interactive activities) are likely to translate "
            "directly into better outcomes for this student."
        )
        created.append(_queue(student_id, "engagement_comparison", text, engagement_result))

    return created


def list_pending_recommendations() -> list[dict[str, Any]]:
    return _list_by_status("pending")


def list_approved_recommendations(student_id: Optional[str] = None) -> list[dict[str, Any]]:
    rows = _list_by_status("approved") + _list_by_status("modified")
    if student_id:
        rows = [r for r in rows if r["student_id"] == student_id]
    rows.sort(key=lambda r: r["created_at"], reverse=True)
    return rows


def _list_by_status(status: str) -> list[dict[str, Any]]:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, student_id, session_id, insight_type, recommendation_text,
                   statistical_evidence, status, modified_text, reviewed_by, reviewed_at,
                   rejection_rationale, created_at
            FROM recommendations
            WHERE status = %s
            ORDER BY created_at DESC
            """,
            (status,),
        )
        cols = [d.name for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def review_recommendation(
    recommendation_id: int,
    action: str,
    reviewer: str,
    modified_text: Optional[str] = None,
    rejection_rationale: Optional[str] = None,
) -> dict[str, Any]:
    if action not in ("approve", "modify", "reject"):
        raise ValueError(f"Unknown action: {action}")

    status = {"approve": "approved", "modify": "modified", "reject": "rejected"}[action]

    with get_cursor() as cur:
        cur.execute(
            """
            UPDATE recommendations
            SET status = %s, reviewed_by = %s, reviewed_at = CURRENT_TIMESTAMP,
                modified_text = %s, rejection_rationale = %s
            WHERE id = %s
            RETURNING id, student_id, session_id, insight_type, recommendation_text,
                      statistical_evidence, status, modified_text, reviewed_by, reviewed_at,
                      rejection_rationale, created_at
            """,
            (status, reviewer, modified_text, rejection_rationale, recommendation_id),
        )
        row = cur.fetchone()
        if row is None:
            raise LookupError(f"No recommendation with id {recommendation_id}")
        cols = [d.name for d in cur.description]
        return dict(zip(cols, row))
