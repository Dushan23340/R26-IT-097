"""
Synthetic data generator for Student Learning Analytics.

Populates the PostgreSQL database with realistic mock data across
student_profiles, learning_sessions, lo_achievement_scores,
emotional_states, and engagement_metrics.

Uses the connection pool from config.database and Faker for identities.

Usage:
    cd analytics-service
    python -m utils.data_generator
"""

import random
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
from faker import Faker
from dotenv import load_dotenv

from config.database import get_cursor

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
NUM_STUDENTS = 20
SESSIONS_PER_STUDENT = 10

GRADE_LEVELS = ["9", "10", "11", "12"]
LESSON_IDS = [f"lesson_{i:03d}" for i in range(1, 31)]

# Bloom's taxonomy levels with (mean, std) for score generation
BLOOM_LEVELS = [
    ("remember", 75, 12),
    ("understand", 72, 13),
    ("apply", 68, 15),
    ("analyze", 65, 16),
    ("evaluate", 62, 17),
    ("create", 60, 18),
]

# Emotion distribution – maps to schema CHECK constraint values
# Note: 'frustrated' is mapped to 'angry' (closest schema-valid label)
EMOTION_CHOICES = [
    ("happy", 0.35),
    ("neutral", 0.30),
    ("confused", 0.15),
    ("bored", 0.10),
    ("angry", 0.07),       # represents "frustrated" in spec
    ("surprised", 0.03),
]
EMOTION_LABELS = [e[0] for e in EMOTION_CHOICES]
EMOTION_WEIGHTS = [e[1] for e in EMOTION_CHOICES]

# Student archetype fractions
IMPROVING_FRAC = 0.30
DECLINING_FRAC = 0.20
# Stable = 1 - IMPROVING_FRAC - DECLINING_FRAC = 0.50

faker = Faker()


# ---------------------------------------------------------------------------
# Helper: pick archetype
# ---------------------------------------------------------------------------
def _assign_archetype(index: int) -> str:
    """Deterministically assign archetype based on student index."""
    if index < int(NUM_STUDENTS * IMPROVING_FRAC):
        return "improving"
    if index < int(NUM_STUDENTS * (IMPROVING_FRAC + DECLINING_FRAC)):
        return "declining"
    return "stable"


# ---------------------------------------------------------------------------
# Helper: clip a value
# ---------------------------------------------------------------------------
def _clip(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


# =========================================================================
# SyntheticDataGenerator
# =========================================================================
class SyntheticDataGenerator:
    """Generate and insert realistic synthetic analytics data."""

    # ---- 1. Students ---------------------------------------------------
    def generate_students(self) -> list[dict]:
        """Create 20 synthetic student profiles.

        Returns list of dicts with keys: student_id, full_name, email,
        enrollment_date, grade_level.
        """
        print("🔹 Generating 20 student profiles …")
        students: list[dict] = []

        for i in range(NUM_STUDENTS):
            first = faker.first_name()
            last = faker.last_name()
            email = f"{first.lower()}.{last.lower()}@student.edu"
            enrollment = faker.date_between(
                start_date="-6M", end_date="today"
            )
            grade = random.choice(GRADE_LEVELS)

            student = {
                "student_id": f"STU_{i + 1:03d}",
                "full_name": f"{first} {last}",
                "email": email,
                "enrollment_date": enrollment,
                "grade_level": grade,
            }
            students.append(student)

        # Bulk insert
        try:
            with get_cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO student_profiles
                        (student_id, full_name, email, enrollment_date, grade_level)
                    VALUES (%(student_id)s, %(full_name)s, %(email)s,
                            %(enrollment_date)s, %(grade_level)s)
                    """,
                    students,
                )
            print(f"   ✅ Inserted {len(students)} student profiles")
        except Exception as exc:
            print(f"   ❌ Failed to insert students: {exc}")
            raise

        return students

    # ---- 2. Sessions ---------------------------------------------------
    def generate_sessions(self, student_id: str) -> list[dict]:
        """Generate 10 learning sessions for a student over 3 months.

        Returns list of dicts ready for insertion into learning_sessions.
        Each dict also carries the generated session_id for downstream use.
        """
        now = datetime.now()
        window_start = now - timedelta(days=90)

        sessions: list[dict] = []
        # Evenly space sessions across the 3-month window with some jitter
        base_interval = 90 / SESSIONS_PER_STUDENT

        for i in range(SESSIONS_PER_STUDENT):
            day_offset = base_interval * i + random.uniform(-3, 3)
            start = window_start + timedelta(days=day_offset,
                                             hours=random.randint(8, 18),
                                             minutes=random.randint(0, 59))
            duration_minutes = random.randint(30, 120)
            duration_seconds = duration_minutes * 60
            end = start + timedelta(seconds=duration_seconds)

            lesson_id = random.choice(LESSON_IDS)

            sessions.append({
                "student_id": student_id,
                "lesson_id": lesson_id,
                "lesson_title": f"Lesson {lesson_id.replace('lesson_', '')}",
                "start_time": start,
                "end_time": end,
                "duration_seconds": duration_seconds,
            })

        # Insert and retrieve generated session_ids
        inserted: list[dict] = []
        try:
            with get_cursor() as cur:
                for s in sessions:
                    cur.execute(
                        """
                        INSERT INTO learning_sessions
                            (student_id, lesson_id, lesson_title,
                             start_time, end_time, duration_seconds)
                        VALUES (%(student_id)s, %(lesson_id)s, %(lesson_title)s,
                                %(start_time)s, %(end_time)s, %(duration_seconds)s)
                        RETURNING session_id
                        """,
                        s,
                    )
                    row = cur.fetchone()
                    s["session_id"] = row[0]
                    inserted.append(s)
        except Exception as exc:
            print(f"   ❌ Failed to insert sessions for {student_id}: {exc}")
            raise

        return inserted

    # ---- 3. LO Achievement Scores --------------------------------------
    def generate_lo_scores(
        self,
        session_id,
        student_id: str,
        session_index: int,
        trend_type: str,
        engagement_score: float,
        negative_emotion_ratio: float,
    ) -> None:
        """Generate 6 Bloom-level LO scores for one session.

        trend_type adjusts the baseline over session_index:
            improving  → +5-8 pts over 10 sessions
            declining  → -3-6 pts over 10 sessions
            stable     → ±3 pts random

        engagement_score (0-1) adds +5-10 pts for high engagement.
        negative_emotion_ratio (0-1) subtracts 3-7 pts for more negativity.
        """
        rows: list[dict] = []

        for level, mean, std in BLOOM_LEVELS:
            # --- trend adjustment ---
            progress = session_index / max(SESSIONS_PER_STUDENT - 1, 1)
            if trend_type == "improving":
                trend_delta = random.uniform(5, 8) * progress
            elif trend_type == "declining":
                trend_delta = -random.uniform(3, 6) * progress
            else:
                trend_delta = random.uniform(-3, 3)

            # --- engagement correlation ---
            engagement_boost = engagement_score * random.uniform(5, 10)

            # --- negative-emotion correlation ---
            emotion_penalty = negative_emotion_ratio * random.uniform(3, 7)

            raw = np.random.normal(mean + trend_delta, std)
            score = _clip(raw + engagement_boost - emotion_penalty)
            # Round to 2 decimal places to fit NUMERIC(5,2)
            score = round(score, 2)

            rows.append({
                "session_id": session_id,
                "student_id": student_id,
                "lo_level": level,
                "score": score,
            })

        try:
            with get_cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO lo_achievement_scores
                        (session_id, student_id, lo_level, score)
                    VALUES (%(session_id)s, %(student_id)s,
                            %(lo_level)s, %(score)s)
                    """,
                    rows,
                )
        except Exception as exc:
            print(f"   ❌ Failed to insert LO scores: {exc}")
            raise

    # ---- 4. Emotional States -------------------------------------------
    def generate_emotions(
        self,
        session_id,
        student_id: str,
        session_duration_seconds: int,
    ) -> float:
        """Generate 15-25 emotional-state snapshots for one session.

        Returns the ratio of negative emotions (bored + angry) among all
        snapshots, used later for LO-score correlation.
        """
        num_snapshots = random.randint(15, 25)
        interval = session_duration_seconds / num_snapshots

        # Pick a reference start_time for this session to build timestamps
        # We fetch it from the DB to be precise; or we just use the session
        # data we already have.  Since we pass duration only, we build from
        # a fictional start = now - duration, which is fine for synthetic data.
        base_time = datetime.now() - timedelta(seconds=session_duration_seconds)

        rows: list[dict] = []
        negative_count = 0

        for i in range(num_snapshots):
            offset = timedelta(seconds=interval * i + random.uniform(0, interval * 0.5))
            ts = base_time + offset
            label = random.choices(EMOTION_LABELS, weights=EMOTION_WEIGHTS, k=1)[0]
            confidence = round(random.uniform(0.70, 0.95), 2)

            if label in ("bored", "angry"):
                negative_count += 1

            rows.append({
                "session_id": session_id,
                "student_id": student_id,
                "timestamp": ts,
                "emotion_label": label,
                "confidence": confidence,
            })

        negative_ratio = negative_count / num_snapshots

        try:
            with get_cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO emotional_states
                        (session_id, student_id, timestamp,
                         emotion_label, confidence)
                    VALUES (%(session_id)s, %(student_id)s,
                            %(timestamp)s, %(emotion_label)s, %(confidence)s)
                    """,
                    rows,
                )
        except Exception as exc:
            print(f"   ❌ Failed to insert emotional states: {exc}")
            raise

        return negative_ratio

    # ---- 5. Engagement Metrics -----------------------------------------
    def generate_engagement(
        self,
        session_id,
        student_id: str,
        session_duration_seconds: int,
    ) -> float:
        """Generate engagement metrics for one session.

        Returns the engagement_score (0-1) for use in LO-score correlation.
        """
        # Beta(2,2) scaled to 0-1
        engagement_score = round(float(np.random.beta(2, 2)), 2)

        # Time on task: 70-95 % of total duration
        pct = random.uniform(0.70, 0.95)
        time_on_task = int(session_duration_seconds * pct)

        # Interaction count: Poisson(lambda=45), clipped >= 20
        interaction_count = max(int(np.random.poisson(45)), 0)

        # Quiz attempts: weighted 1(40%), 2(40%), 3(20%)
        quiz_attempts = random.choices([1, 2, 3], weights=[40, 40, 20], k=1)[0]

        row = {
            "session_id": session_id,
            "student_id": student_id,
            "engagement_score": engagement_score,
            "time_on_task_seconds": time_on_task,
            "interaction_count": interaction_count,
            "quiz_attempts": quiz_attempts,
        }

        try:
            with get_cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO engagement_metrics
                        (session_id, student_id, engagement_score,
                         time_on_task_seconds, interaction_count, quiz_attempts)
                    VALUES (%(session_id)s, %(student_id)s,
                            %(engagement_score)s, %(time_on_task_seconds)s,
                            %(interaction_count)s, %(quiz_attempts)s)
                    """,
                    row,
                )
        except Exception as exc:
            print(f"   ❌ Failed to insert engagement metrics: {exc}")
            raise

        return engagement_score

    # ---- 6. Orchestrator -----------------------------------------------
    def run(self) -> None:
        """Generate and insert all synthetic data.

        Order: students → sessions → (engagement, emotions, LO scores).
        Engagement and emotions are generated first so their values can
        inform the LO-score correlations.
        """
        print("=" * 55)
        print("  Synthetic Data Generator — Student Learning Analytics")
        print("=" * 55)

        # -- Students --
        students = self.generate_students()

        # -- Per-student data --
        total_sessions = 0
        total_lo = 0
        total_emotions = 0
        total_engagement = 0

        for idx, student in enumerate(students):
            sid = student["student_id"]
            archetype = _assign_archetype(idx)
            print(f"\n🔹 Student {sid}  (archetype: {archetype})")

            try:
                sessions = self.generate_sessions(sid)
            except Exception:
                print(f"   ⚠ Skipping remaining data for {sid} due to session error")
                continue

            total_sessions += len(sessions)

            for sess_idx, sess in enumerate(sessions):
                session_id = sess["session_id"]
                dur = sess["duration_seconds"]

                # Engagement first — we need its return value
                try:
                    eng_score = self.generate_engagement(session_id, sid, dur)
                    total_engagement += 1
                except Exception:
                    eng_score = 0.5  # fallback neutral
                    print(f"   ⚠ Using fallback engagement for session {sess_idx + 1}")

                # Emotions next — we need negative_ratio
                try:
                    neg_ratio = self.generate_emotions(session_id, sid, dur)
                    total_emotions += 1
                except Exception:
                    neg_ratio = 0.0  # fallback neutral
                    print(f"   ⚠ Using fallback emotion ratio for session {sess_idx + 1}")

                # LO scores last — uses eng_score & neg_ratio
                try:
                    self.generate_lo_scores(
                        session_id, sid, sess_idx, archetype,
                        eng_score, neg_ratio,
                    )
                    total_lo += 1
                except Exception:
                    print(f"   ⚠ LO score generation failed for session {sess_idx + 1}")

            print(f"   ✅ {len(sessions)} sessions fully populated")

        # -- Summary --
        print("\n" + "=" * 55)
        print("  Generation Complete — Summary")
        print("=" * 55)
        print(f"  Students            : {NUM_STUDENTS}")
        print(f"  Sessions            : {total_sessions}")
        print(f"  LO score sets       : {total_lo}  (×6 Bloom levels each)")
        print(f"  Emotion snapshots   : ~{total_emotions * 20}")
        print(f"  Engagement records  : {total_engagement}")
        print("=" * 55)


# =========================================================================
# CLI entry point
# =========================================================================
if __name__ == "__main__":
    # Load root .env so ANALYTICS_DB_* variables are available
    project_root = Path(__file__).resolve().parents[2]
    load_dotenv(project_root / ".env")

    generator = SyntheticDataGenerator()
    generator.run()
