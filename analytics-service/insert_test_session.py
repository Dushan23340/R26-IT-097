import os
import uuid
from dotenv import load_dotenv
load_dotenv()
import psycopg2

conn = psycopg2.connect(
    host=os.getenv("DB_HOST", "localhost"),
    port=int(os.getenv("DB_PORT", 5432)),
    dbname=os.getenv("DB_NAME", "adaptive_learning_analytics"),
    user=os.getenv("DB_USER", "postgres"),
    password=os.getenv("DB_PASSWORD"),
)
conn.autocommit = True
cur = conn.cursor()

session_id = str(uuid.uuid4())

# Insert test session AFTER suggestion creation time (2026-06-23T22:01)
cur.execute("""
    INSERT INTO learning_sessions
        (session_id, student_id, lesson_id, lesson_title, start_time, duration_seconds)
    VALUES (%s, %s, %s, %s, %s, %s)
""", (session_id, "STU_008", "lesson_030", "Lesson 030", "2026-06-24 10:00:00", 3600))

# Insert LO score with required lo_level field
cur.execute("""
    INSERT INTO lo_achievement_scores
        (session_id, student_id, lo_level, score, max_score)
    VALUES (%s, %s, %s, %s, %s)
""", (session_id, "STU_008", "remember", 72.5, 100.0))

# Insert engagement with all required fields
cur.execute("""
    INSERT INTO engagement_metrics
        (session_id, student_id, engagement_score, time_on_task_seconds,
         interaction_count, quiz_attempts)
    VALUES (%s, %s, %s, %s, %s, %s)
""", (session_id, "STU_008", 0.75, 3200, 15, 2))

print("Test session created:", session_id)
cur.close()
conn.close()