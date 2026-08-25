"""Intervention Outcome Tracking (SO5's second half, FR08).

Approving a recommendation used to be a dead end - nothing forwarded it
anywhere and nothing checked whether it helped. This module:

  1. Creates an intervention_outcomes row when a recommendation is
     approved/modified, anchoring "pre" to the student's most recent
     session for that lesson AT THE TIME OF REVIEW (not looked up fresh
     later, which could drift if new sessions land before evaluation).
  2. Reactively resolves pending rows whenever a new session's LO scores
     land for the same student+lesson (routes/profiles.py calls
     try_resolve_pending() after every POST /lo-scores) - self-correcting:
     each call recomputes the post-session's average from whatever scores
     exist for it so far, converging to the right answer once all of that
     session's LO scores have been posted.

Never claims causation - outcome labels describe what was OBSERVED
(scores improved/didn't/declined), not that the recommendation CAUSED it.
"""

from __future__ import annotations

from typing import Any, Optional

from config.database import get_cursor
from services import profile_service

IMPROVEMENT_THRESHOLD = 5.0  # percentile points; matches the +/-5pt convention used elsewhere in this module


def classify_outcome(pre_score: float, post_score: float) -> str:
    delta = post_score - pre_score
    if delta > IMPROVEMENT_THRESHOLD:
        return "improved"
    if delta < -IMPROVEMENT_THRESHOLD:
        return "declined"
    return "no_significant_change"


def create_intervention_outcome(recommendation_id: int, student_id: str, lesson_id: str, created_at) -> Optional[int]:
    """Called from validation_service.review_recommendation() on approve/
    modify. Returns None (not an error - just nothing to track) if this
    student has no session for `lesson_id` yet, which can genuinely happen
    for a whole-profile trend/stability recommendation generated before
    the student ever attempted their most-recent lesson's retake."""
    baseline = profile_service.get_latest_lesson_session_before(student_id, lesson_id, created_at)
    if baseline is None:
        return None

    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO intervention_outcomes (recommendation_id, student_id, lesson_id, pre_session_id, pre_score)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (recommendation_id, student_id, lesson_id, baseline["session_id"], baseline["avg_score"]),
        )
        return int(cur.fetchone()[0])


def try_resolve_pending(student_id: str, lesson_id: str) -> None:
    """Called after every POST /lo-scores. Finds any pending
    intervention_outcomes row for this student+lesson whose pre_session
    predates a newer real session, and (re)computes the post measurement
    from that newer session's LO scores so far."""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, pre_session_id, pre_score FROM intervention_outcomes
            WHERE student_id = %s AND lesson_id = %s AND outcome = 'pending'
            """,
            (student_id, lesson_id),
        )
        pending_rows = cur.fetchall()

    for outcome_id, pre_session_id, pre_score in pending_rows:
        newer = profile_service.find_newer_session_for_lesson(student_id, lesson_id, str(pre_session_id))
        if newer is None:
            continue

        outcome = classify_outcome(float(pre_score), newer["avg_score"])
        with get_cursor() as cur:
            cur.execute(
                """
                UPDATE intervention_outcomes
                SET post_session_id = %s, post_score = %s, outcome = %s, evaluated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                """,
                (newer["session_id"], newer["avg_score"], outcome, outcome_id),
            )


def list_interventions(student_id: str) -> list[dict[str, Any]]:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT io.id, io.recommendation_id, io.lesson_id, io.pre_score, io.post_score,
                   io.outcome, io.created_at, io.evaluated_at, r.insight_type, r.recommendation_text
            FROM intervention_outcomes io
            JOIN recommendations r ON r.id = io.recommendation_id
            WHERE io.student_id = %s
            ORDER BY io.created_at DESC
            """,
            (student_id,),
        )
        cols = [d.name for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def effectiveness_summary() -> list[dict[str, Any]]:
    """Per recommendation type: applications, improved-count, avg
    improvement - the exact shape the proposal's own example table shows
    (SO5: "evaluates the quality of implemented suggestions")."""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT r.insight_type, io.outcome, io.pre_score, io.post_score
            FROM intervention_outcomes io
            JOIN recommendations r ON r.id = io.recommendation_id
            WHERE io.outcome != 'pending'
            """
        )
        rows = cur.fetchall()

    by_type: dict[str, list[tuple]] = {}
    for insight_type, outcome, pre_score, post_score in rows:
        by_type.setdefault(insight_type, []).append((outcome, float(pre_score), float(post_score)))

    summary = []
    for insight_type, entries in sorted(by_type.items()):
        improved = sum(1 for outcome, _, _ in entries if outcome == "improved")
        declined = sum(1 for outcome, _, _ in entries if outcome == "declined")
        no_change = sum(1 for outcome, _, _ in entries if outcome == "no_significant_change")
        avg_improvement = sum(post - pre for _, pre, post in entries) / len(entries)
        summary.append({
            "insight_type": insight_type,
            "applications": len(entries),
            "improved": improved,
            "no_significant_change": no_change,
            "declined": declined,
            "avg_improvement_points": round(avg_improvement, 2),
        })
    return summary
