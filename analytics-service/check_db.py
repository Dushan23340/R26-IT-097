import os
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
cur = conn.cursor()

print("=== lo_achievement_scores COLUMNS ===")
cur.execute("""
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'lo_achievement_scores'
    ORDER BY ordinal_position
""")
for r in cur.fetchall():
    print(r)

print("\n=== SAMPLE lo_achievement_scores ROW ===")
cur.execute("SELECT * FROM lo_achievement_scores LIMIT 1")
for r in cur.fetchall():
    print(r)

print("\n=== engagement_metrics COLUMNS ===")
cur.execute("""
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'engagement_metrics'
    ORDER BY ordinal_position
""")
for r in cur.fetchall():
    print(r)

cur.close()
conn.close()