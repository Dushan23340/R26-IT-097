"""Synthetic data generator for testing/demo (proposal Table 2: Faker).

Generates a class of students across demographic groups with realistic-ish
session histories - some improving, some declining, some volatile, so the
statistics/fairness endpoints have something non-trivial to compute over.
Development/demo only; the schema.sql tables this writes to are the real
production tables, so don't run this against real student data.
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta

from faker import Faker

from services import intervention_service, profile_service, validation_service, statistics_service

fake = Faker()
random.seed(42)

DEMOGRAPHIC_GROUPS = ["GroupA", "GroupB", "GroupC"]
GRADE_LEVELS = ["Grade 9", "Grade 10", "Grade 11"]
LO_LEVELS = ["remember", "understand", "apply", "analyze", "evaluate", "create"]
EMOTIONS_BY_PERFORMANCE = {
    "high": ["happy", "normal"],
    "low": ["bored", "confused", "frustrated"],
}

TRAJECTORIES = ["improving", "declining", "stable", "volatile"]

# Mirrors adaptive-learning/backend/lessons.py's real LESSON_DIFFICULTY map
# (kept in sync manually - these two services don't share code) so the
# synthetic data's difficulty-vs-achievement signal lines up with what a
# real deployment would actually see, and so lesson-by-lesson intelligence
# has real, recognizable lesson_ids instead of a per-session lesson-N that
# never repeats (which meant no lesson ever had >1 session, so per-lesson
# trend/stability could never compute at all - MIN_SESSIONS_FOR_TREND=3).
LESSON_CATALOG = [
    ("percentages", "easy"),
    ("number-patterns", "medium"),
    ("fractions-bodmas", "medium"),
    ("area-of-shapes", "medium"),
    ("binary-numbers", "hard"),
    ("sets", "hard"),
]


def _score_for_session(trajectory: str, session_index: int, total_sessions: int) -> float:
    progress = session_index / max(1, total_sessions - 1)
    if trajectory == "improving":
        base = 45 + progress * 45
    elif trajectory == "declining":
        base = 90 - progress * 45
    elif trajectory == "volatile":
        base = 60
    else:  # stable
        base = 78

    noise = random.uniform(-15, 15) if trajectory == "volatile" else random.uniform(-6, 6)
    return round(max(5, min(100, base + noise)), 1)


def seed(num_students: int = 24, sessions_per_student: int = 12) -> None:
    print(f"Seeding {num_students} synthetic students, {sessions_per_student} sessions each...")

    seeded_student_ids: list[str] = []

    for i in range(num_students):
        student_id = f"SYN_{i:03d}"
        seeded_student_ids.append(student_id)
        group = DEMOGRAPHIC_GROUPS[i % len(DEMOGRAPHIC_GROUPS)]
        trajectory = TRAJECTORIES[i % len(TRAJECTORIES)]

        profile_service.upsert_student(
            student_id=student_id,
            full_name=fake.name(),
            email=fake.unique.email(),
            enrollment_date=fake.date_between(start_date="-2y", end_date="-6M").isoformat(),
            grade_level=random.choice(GRADE_LEVELS),
            demographic_group=group,
        )

        start = datetime(2026, 1, 5)
        for s in range(sessions_per_student):
            # Cycles through the same ~10 real lessons rather than a
            # per-session lesson-N that never repeats - gives each lesson
            # multiple sessions per student, which per-lesson trend/
            # stability (lesson_intelligence_service.py) needs at least 3
            # of to compute anything at all.
            lesson_id, difficulty = LESSON_CATALOG[s % len(LESSON_CATALOG)]
            session_start = start + timedelta(days=s * 3, hours=random.randint(0, 5))
            score = _score_for_session(trajectory, s, sessions_per_student)

            session_id = profile_service.create_session(
                student_id=student_id,
                lesson_id=lesson_id,
                lesson_title=lesson_id.replace("-", " ").title(),
                start_time=session_start,
                end_time=session_start + timedelta(minutes=random.randint(15, 40)),
                difficulty=difficulty,
            )

            for lo_level in random.sample(LO_LEVELS, k=random.randint(1, 3)):
                profile_service.record_lo_score(
                    session_id=session_id,
                    student_id=student_id,
                    lo_level=lo_level,
                    score=round(max(0, min(100, score + random.uniform(-8, 8))), 1),
                )

            engagement_score = round(max(0.05, min(1.0, (score / 100) + random.uniform(-0.15, 0.15))), 2)
            profile_service.record_engagement_metrics(
                session_id=session_id,
                student_id=student_id,
                engagement_score=engagement_score,
                time_on_task_seconds=random.randint(180, 2400),
                interaction_count=random.randint(3, 40),
                quiz_attempts=random.randint(1, 3),
            )

            emotion_pool = EMOTIONS_BY_PERFORMANCE["high" if score >= 65 else "low"]
            for _ in range(random.randint(2, 5)):
                profile_service.record_emotional_state(
                    session_id=session_id,
                    student_id=student_id,
                    emotion_label=random.choice(emotion_pool),
                    confidence=round(random.uniform(0.6, 0.98), 2),
                    timestamp=session_start + timedelta(minutes=random.randint(0, 30)),
                )

        if (i + 1) % 5 == 0:
            print(f"  ...{i + 1}/{num_students} students seeded")

    print("Sessions seeded. Simulating recommendation -> approve -> retake -> evaluate cycle...")
    _simulate_intervention_cycle(seeded_student_ids)

    print("Done.")


def _simulate_intervention_cycle(student_ids: list[str]) -> None:
    """Gives GET /interventions/effectiveness and GET /students/<id>/interventions
    (Gap 4) real synthetic data to demonstrate, the same way the rest of
    this script already does for trend/stability/fairness: for each
    "declining" student (most likely to produce a real trend
    recommendation), generate + auto-approve any recommendations, then
    simulate a retake session for the recommendation's lesson with an
    improved score and let the same reactive resolution path production
    traffic uses (intervention_service.try_resolve_pending) close it out."""
    all_history = {sid: profile_service.get_student_lo_history(sid) for sid in student_ids}
    baseline = statistics_service.compute_class_stability_baseline(all_history)

    declining_students = [sid for i, sid in enumerate(student_ids) if TRAJECTORIES[i % len(TRAJECTORIES)] == "declining"]

    for student_id in declining_students:
        recommendation_ids = validation_service.analyze_student_and_queue_recommendations(student_id, baseline)
        for rec_id in recommendation_ids:
            approved = validation_service.review_recommendation(
                rec_id, action="approve", reviewer="Ms. Suranjini Silva (seed script)"
            )
            lesson_id = approved.get("lesson_id")
            if not lesson_id:
                continue

            # A retake, same lesson, genuinely improved score - simulates the
            # student having acted on the guided-practice recommendation.
            last_session = max(
                (row for row in all_history[student_id] if row["lesson_id"] == lesson_id),
                key=lambda row: row["start_time"],
                default=None,
            )
            if last_session is None:
                continue

            retake_start = last_session["start_time"] + timedelta(days=2)
            retake_session_id = profile_service.create_session(
                student_id=student_id,
                lesson_id=lesson_id,
                lesson_title=lesson_id.replace("-", " ").title(),
                start_time=retake_start,
                end_time=retake_start + timedelta(minutes=25),
                difficulty=dict(LESSON_CATALOG)[lesson_id],
            )
            improved_score = round(min(100, float(last_session["score"]) + random.uniform(15, 30)), 1)
            for lo_level in random.sample(LO_LEVELS, k=2):
                profile_service.record_lo_score(
                    session_id=retake_session_id, student_id=student_id, lo_level=lo_level, score=improved_score
                )
                intervention_service.try_resolve_pending(student_id, lesson_id)


if __name__ == "__main__":
    seed()
