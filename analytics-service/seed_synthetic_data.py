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

from services import profile_service

fake = Faker()
random.seed(42)

DEMOGRAPHIC_GROUPS = ["GroupA", "GroupB", "GroupC"]
GRADE_LEVELS = ["Grade 9", "Grade 10", "Grade 11"]
LO_LEVELS = ["remember", "understand", "apply", "analyze", "evaluate", "create"]
DIFFICULTIES = ["easy", "medium", "hard"]
EMOTIONS_BY_PERFORMANCE = {
    "high": ["happy", "normal"],
    "low": ["bored", "confused", "frustrated"],
}

TRAJECTORIES = ["improving", "declining", "stable", "volatile"]


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


def seed(num_students: int = 24, sessions_per_student: int = 8) -> None:
    print(f"Seeding {num_students} synthetic students, {sessions_per_student} sessions each...")

    for i in range(num_students):
        student_id = f"SYN_{i:03d}"
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
            session_start = start + timedelta(days=s * 3, hours=random.randint(0, 5))
            score = _score_for_session(trajectory, s, sessions_per_student)

            session_id = profile_service.create_session(
                student_id=student_id,
                lesson_id=f"lesson-{s}",
                lesson_title=f"{fake.word().capitalize()} Fundamentals {s + 1}",
                start_time=session_start,
                end_time=session_start + timedelta(minutes=random.randint(15, 40)),
                difficulty=random.choice(DIFFICULTIES),
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

    print("Done.")


if __name__ == "__main__":
    seed()
