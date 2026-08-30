"""Persistent profile ingestion and retrieval (SO1).

Thin wrappers around config.database.get_cursor() for the five tables in
models/schema.sql + migration_001 (student_profiles, learning_sessions,
lo_achievement_scores, emotional_states, engagement_metrics,
recommendations).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from config.database import get_cursor


def upsert_student(
    student_id: str,
    full_name: str,
    email: str,
    enrollment_date: str,
    grade_level: str,
    demographic_group: Optional[str] = None,
) -> None:
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO student_profiles
                (student_id, full_name, email, enrollment_date, grade_level, demographic_group)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (student_id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                email = EXCLUDED.email,
                grade_level = EXCLUDED.grade_level,
                demographic_group = COALESCE(EXCLUDED.demographic_group, student_profiles.demographic_group)
            """,
            (student_id, full_name, email, enrollment_date, grade_level, demographic_group),
        )


def student_exists(student_id: str) -> bool:
    with get_cursor() as cur:
        cur.execute("SELECT 1 FROM student_profiles WHERE student_id = %s", (student_id,))
        return cur.fetchone() is not None


def ensure_student(student_id: str) -> None:
    """Auto-create a minimal profile if one doesn't exist yet - callers like
    the emotion-service webhook only know a student_id, not a full profile."""
    if student_exists(student_id):
        return
    upsert_student(
        student_id=student_id,
        full_name=student_id,
        email=f"{student_id}@unknown.local",
        enrollment_date=datetime.utcnow().date().isoformat(),
        grade_level="unspecified",
    )


def create_session(
    student_id: str,
    lesson_id: str,
    lesson_title: str,
    start_time: datetime,
    end_time: Optional[datetime] = None,
    difficulty: Optional[str] = None,
) -> str:
    ensure_student(student_id)
    duration_seconds = None
    if end_time is not None:
        duration_seconds = max(0, int((end_time - start_time).total_seconds()))

    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO learning_sessions
                (student_id, lesson_id, lesson_title, start_time, end_time, duration_seconds, difficulty)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING session_id
            """,
            (student_id, lesson_id, lesson_title, start_time, end_time, duration_seconds, difficulty),
        )
        return str(cur.fetchone()[0])


def record_lo_score(
    session_id: str,
    student_id: str,
    lo_level: str,
    score: float,
    max_score: float = 100.0,
) -> None:
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO lo_achievement_scores (session_id, student_id, lo_level, score, max_score)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (session_id, student_id, lo_level, score, max_score),
        )


def record_emotional_state(
    session_id: str,
    student_id: str,
    emotion_label: str,
    confidence: float,
    timestamp: Optional[datetime] = None,
) -> None:
    ensure_student(student_id)
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO emotional_states (session_id, student_id, timestamp, emotion_label, confidence)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (session_id, student_id, timestamp or datetime.utcnow(), emotion_label, min(1.0, max(0.0, confidence))),
        )


def copy_emotional_states(from_session_id: str, to_session_id: str, student_id: str) -> int:
    """Duplicates every emotional_states row from a live-class session onto
    a quiz-submission session for the same student and lesson - the two
    are otherwise permanently disconnected sessions (a live class's
    lesson_id is always "live-class", a quiz's session is created fresh
    per submission with its own accurate start/end/duration for its own
    engagement metrics, so the live class's session can't just BE the quiz
    session). Called from adaptive_bridge's quiz-submit push when
    lesson_progress recorded a live-class analytics_session_id for this
    lesson - lets "negative emotion % vs performance" correlate a real
    session's readings against that lesson's real quiz score instead of
    every session showing up as emotion-only or score-only. Returns the
    number of rows copied (0 if the source session had none, e.g. it was
    already used for an earlier quiz retake of the same lesson)."""
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO emotional_states (session_id, student_id, timestamp, emotion_label, confidence)
            SELECT %s, student_id, timestamp, emotion_label, confidence
            FROM emotional_states
            WHERE session_id = %s AND student_id = %s
            """,
            (to_session_id, from_session_id, student_id),
        )
        return cur.rowcount


def record_engagement_metrics(
    session_id: str,
    student_id: str,
    engagement_score: float,
    time_on_task_seconds: int,
    interaction_count: int,
    quiz_attempts: int = 0,
) -> None:
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO engagement_metrics
                (session_id, student_id, engagement_score, time_on_task_seconds, interaction_count, quiz_attempts)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (session_id, student_id, engagement_score, time_on_task_seconds, interaction_count, quiz_attempts),
        )


def get_all_students() -> list[dict[str, Any]]:
    with get_cursor() as cur:
        cur.execute(
            "SELECT student_id, full_name, email, grade_level, demographic_group FROM student_profiles ORDER BY student_id"
        )
        cols = [d.name for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def get_student_lo_history(student_id: str) -> list[dict[str, Any]]:
    """LO scores across sessions, ordered chronologically - the raw series
    the statistics engine runs trend/stability analysis over."""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT ls.session_id, ls.start_time, ls.lesson_id, ls.difficulty,
                   los.lo_level, los.score, los.max_score
            FROM lo_achievement_scores los
            JOIN learning_sessions ls ON ls.session_id = los.session_id
            WHERE los.student_id = %s
            ORDER BY ls.start_time ASC
            """,
            (student_id,),
        )
        cols = [d.name for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def get_student_emotional_states(student_id: str) -> list[dict[str, Any]]:
    """lesson_id/lesson_title joined in (not just session_id) so callers can
    tell live-class emotion readings (lesson_id="live-class" - see
    emotion-backend's student_profile_bridge.create_session) apart from
    quiz-session readings, since quiz-taking doesn't capture emotion at all
    today and would otherwise be indistinguishable at this level."""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT es.session_id, es.timestamp, es.emotion_label, es.confidence,
                   ls.lesson_id, ls.lesson_title, ls.start_time
            FROM emotional_states es
            JOIN learning_sessions ls ON ls.session_id = es.session_id
            WHERE es.student_id = %s
            ORDER BY es.timestamp ASC
            """,
            (student_id,),
        )
        cols = [d.name for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def get_latest_class_dominant_emotion(student_id: str) -> Optional[dict[str, Any]]:
    """The single most-frequent emotion_label during this student's most
    recent LIVE CLASS session (lesson_id='live-class', per
    student_profile_bridge.create_session) - not their lifetime history
    (unlike routes/analytics.py's class_overview(), which is unscoped by
    session) and not their instantaneous live-tracker state (unlike
    analytics_bridge.get_live_emotion() in adaptive-learning/backend, which
    reads emotion-service's ~12s rolling smoothed value directly)."""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT es.emotion_label
            FROM emotional_states es
            JOIN learning_sessions ls ON ls.session_id = es.session_id
            WHERE ls.student_id = %s AND ls.lesson_id = 'live-class'
              AND ls.session_id = (
                  SELECT session_id FROM learning_sessions
                  WHERE student_id = %s AND lesson_id = 'live-class'
                  ORDER BY start_time DESC LIMIT 1
              )
            """,
            (student_id, student_id),
        )
        labels = [row[0] for row in cur.fetchall()]

    if not labels:
        return None

    counts: dict[str, int] = {}
    for label in labels:
        counts[label] = counts.get(label, 0) + 1
    dominant = max(counts, key=counts.get)

    return {"dominant_emotion": dominant, "sample_count": len(labels)}


def get_student_engagement(student_id: str) -> list[dict[str, Any]]:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT em.session_id, ls.start_time, ls.lesson_id, ls.lesson_title,
                   em.engagement_score, em.time_on_task_seconds, em.interaction_count
            FROM engagement_metrics em
            JOIN learning_sessions ls ON ls.session_id = em.session_id
            WHERE em.student_id = %s
            ORDER BY ls.start_time ASC
            """,
            (student_id,),
        )
        cols = [d.name for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def get_latest_lesson_session_before(student_id: str, lesson_id: str, before) -> Optional[dict[str, Any]]:
    """Most recent session (+ its avg LO score) for this student+lesson at
    or before `before` - the "pre" baseline for intervention outcome
    tracking, anchored to the recommendation's created_at so it can't drift
    if the teacher reviews it days later."""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT session_id FROM learning_sessions
            WHERE student_id = %s AND lesson_id = %s AND start_time <= %s
            ORDER BY start_time DESC LIMIT 1
            """,
            (student_id, lesson_id, before),
        )
        row = cur.fetchone()
        if not row:
            return None
        session_id = str(row[0])

        avg_score = _session_avg_score(cur, session_id)
        if avg_score is None:
            return None
        return {"session_id": session_id, "avg_score": avg_score}


def find_newer_session_for_lesson(student_id: str, lesson_id: str, after_session_id: str) -> Optional[dict[str, Any]]:
    """The next session (if any) for this student+lesson strictly after
    `after_session_id`'s start_time - used to detect a real retake/
    post-intervention attempt."""
    with get_cursor() as cur:
        cur.execute("SELECT start_time FROM learning_sessions WHERE session_id = %s", (after_session_id,))
        anchor = cur.fetchone()
        if not anchor:
            return None

        cur.execute(
            """
            SELECT session_id FROM learning_sessions
            WHERE student_id = %s AND lesson_id = %s AND start_time > %s
            ORDER BY start_time ASC LIMIT 1
            """,
            (student_id, lesson_id, anchor[0]),
        )
        row = cur.fetchone()
        if not row:
            return None
        session_id = str(row[0])

        avg_score = _session_avg_score(cur, session_id)
        if avg_score is None:
            return None
        return {"session_id": session_id, "avg_score": avg_score}


def get_lesson_id_for_session(session_id: str) -> Optional[str]:
    with get_cursor() as cur:
        cur.execute("SELECT lesson_id FROM learning_sessions WHERE session_id = %s", (session_id,))
        row = cur.fetchone()
        return row[0] if row else None


def _session_avg_score(cur, session_id: str) -> Optional[float]:
    cur.execute("SELECT AVG(score) FROM lo_achievement_scores WHERE session_id = %s", (session_id,))
    row = cur.fetchone()
    return float(row[0]) if row and row[0] is not None else None
