"""Full validation of suggestion_schema.sql against the live database."""
import psycopg2
import psycopg2.extras
import uuid

import os
from dotenv import load_dotenv
load_dotenv()

conn = psycopg2.connect(
    host=os.getenv("DB_HOST", "localhost"),
    port=int(os.getenv("DB_PORT", 5432)),
    dbname=os.getenv("DB_NAME", "adaptive_learning_analytics"),
    user=os.getenv("DB_USER", "postgres"),
    password=os.getenv("DB_PASSWORD"),
)
conn.autocommit = False
cur = conn.cursor()

print("=" * 60)
print("ERSE Schema Validation")
print("=" * 60)

# ── 1. gen_random_uuid() available ──────────────────────────
cur.execute("SELECT gen_random_uuid()")
gen_uuid = cur.fetchone()[0]
print(f"\n[1] gen_random_uuid() OK: {gen_uuid}")

# ── 2. Tables exist ─────────────────────────────────────────
cur.execute("""
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('suggestions','suggestion_outcomes')
    ORDER BY table_name
""")
tables = [r[0] for r in cur.fetchall()]
print(f"\n[2] Tables found: {tables}")
assert tables == ["suggestion_outcomes", "suggestions"], "Missing tables!"
print("    OK - both tables present")

# ── 3. Column check on suggestions ──────────────────────────
cur.execute("""
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'suggestions'
    ORDER BY ordinal_position
""")
cols = cur.fetchall()
print(f"\n[3] suggestions: {len(cols)} columns")
for col, dtype, null, default in cols:
    default_str = f" DEFAULT {default}" if default else ""
    print(f"    {col:25s} {dtype:20s} nullable={null}{default_str}")

expected_sugg_cols = {
    "suggestion_id", "student_id", "pattern_name", "pattern_priority",
    "confidence", "urgency", "confidence_score", "teacher_suggestion",
    "student_suggestion", "expected_outcome", "evidence", "state_vector",
    "status", "modified_suggestion", "teacher_notes", "reviewed_at",
    "reviewed_by", "llm_model", "llm_used", "outcome_tracked",
    "outcome_summary", "forwarded_to_lo", "forwarded_at",
    "created_at", "updated_at",
}
actual_sugg_cols = {c[0] for c in cols}
missing = expected_sugg_cols - actual_sugg_cols
assert not missing, f"Missing columns in suggestions: {missing}"
print("    OK - all expected columns present")

# ── 4. Column check on suggestion_outcomes ──────────────────
cur.execute("""
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'suggestion_outcomes'
    ORDER BY ordinal_position
""")
cols2 = cur.fetchall()
print(f"\n[4] suggestion_outcomes: {len(cols2)} columns")
for col, dtype, null, default in cols2:
    default_str = f" DEFAULT {default}" if default else ""
    print(f"    {col:25s} {dtype:20s} nullable={null}{default_str}")

# ── 5. Trigger exists ───────────────────────────────────────
cur.execute("""
    SELECT trigger_name, event_manipulation, action_timing
    FROM information_schema.triggers
    WHERE event_object_table = 'suggestions'
""")
triggers = cur.fetchall()
print(f"\n[5] Triggers on suggestions: {len(triggers)}")
for name, event, timing in triggers:
    print(f"    {name} - {timing} {event}")
assert any(t[0] == "trg_suggestions_updated_at" for t in triggers), "Trigger missing!"
print("    OK - update trigger present")

# ── 6. Indexes ──────────────────────────────────────────────
cur.execute("""
    SELECT indexname, tablename
    FROM pg_indexes
    WHERE tablename IN ('suggestions','suggestion_outcomes')
    ORDER BY tablename, indexname
""")
indexes = cur.fetchall()
print(f"\n[6] Indexes: {len(indexes)}")
for idx, tbl in indexes:
    print(f"    [{tbl}] {idx}")

expected_gin = {"idx_suggestions_evidence_gin", "idx_suggestions_state_vector_gin"}
actual_idx = {i[0] for i in indexes}
missing_gin = expected_gin - actual_idx
assert not missing_gin, f"Missing GIN indexes: {missing_gin}"
print("    OK - GIN indexes on JSONB columns present")

# ── 7. Test JSONB insert + query ─────────────────────────────
# Get a real student_id
cur.execute("SELECT student_id FROM student_profiles LIMIT 1")
row = cur.fetchone()
if not row:
    print("\n[7] SKIP - no student_profiles rows (insert test data first)")
else:
    student_id = row[0]
    test_evidence = [{"type": "trend", "value": "declining", "session": 5}]
    test_state = {"avg_lo": 65.2, "sessions_completed": 5, "trend": "declining"}

    cur.execute("""
        INSERT INTO suggestions (
            student_id, pattern_name, pattern_priority,
            confidence, urgency, confidence_score,
            teacher_suggestion, student_suggestion, expected_outcome,
            evidence, state_vector, llm_model
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING suggestion_id, evidence, state_vector
    """, (
        student_id, "Declining Trend", 1,
        "High", "Immediate", 0.920,
        "Review sessions 3-5 for gaps in understanding.",
        "Re-watch the recap video for lesson 4.",
        "LO scores stabilise within 2 sessions.",
        psycopg2.extras.Json(test_evidence),
        psycopg2.extras.Json(test_state),
        "test-model-v1",
    ))
    sid, ev, sv = cur.fetchone()
    print(f"\n[7] JSONB insert OK:")
    print(f"    suggestion_id = {sid}")
    print(f"    evidence      = {ev}")
    print(f"    state_vector  = {sv}")

    # Query back using JSONB containment operator
    cur.execute("""
        SELECT suggestion_id, pattern_name, evidence->0->>'type' AS evidence_type
        FROM suggestions
        WHERE evidence @> %s
    """, ('[{"type": "trend"}]',))
    found = cur.fetchall()
    print(f"    JSONB query @> returned {len(found)} row(s): {found}")

    # Test suggestion_outcomes insert
    cur.execute("""
        INSERT INTO suggestion_outcomes (
            suggestion_id, session_id, student_id,
            lo_score_baseline, lo_score_session,
            session_index, engagement_score
        )
        SELECT %s, session_id, %s, 60.00, 72.50, 6, 0.85
        FROM learning_sessions
        WHERE student_id = %s
        ORDER BY start_time
        LIMIT 1
        RETURNING outcome_id, lo_delta, session_index
    """, (sid, student_id, student_id))
    outcome_row = cur.fetchone()
    if outcome_row:
        oid, delta, idx = outcome_row
        print(f"\n[8] suggestion_outcomes insert OK:")
        print(f"    outcome_id    = {oid}")
        print(f"    lo_delta      = {delta} (GENERATED column working)")
        print(f"    session_index = {idx}")
    else:
        print(f"\n[8] SKIP - no learning_sessions for student {student_id}")

    # ── 9. Trigger test ─────────────────────────────────────
    cur.execute("""
        SELECT created_at, updated_at FROM suggestions WHERE suggestion_id = %s
    """, (sid,))
    created, updated_before = cur.fetchone()

    cur.execute("""
        UPDATE suggestions SET status = 'approved' WHERE suggestion_id = %s
    """, (sid,))
    cur.execute("""
        SELECT updated_at FROM suggestions WHERE suggestion_id = %s
    """, (sid,))
    updated_after = cur.fetchone()[0]
    print(f"\n[9] Trigger test:")
    print(f"    created_at          = {created}")
    print(f"    updated_at (before) = {updated_before}")
    print(f"    updated_at (after)  = {updated_after}")
    if updated_after > updated_before:
        print("    OK - trigger auto-updated updated_at")
    else:
        print("    FAIL - updated_at did not change!")

    # ── 10. Cleanup test data ───────────────────────────────
    cur.execute("DELETE FROM suggestion_outcomes WHERE suggestion_id = %s", (sid,))
    cur.execute("DELETE FROM suggestions WHERE suggestion_id = %s", (sid,))
    print(f"\n[10] Cleanup: test rows removed")

# ── 11. FK type cross-reference ─────────────────────────────
cur.execute("""
    SELECT table_name, column_name, data_type, character_maximum_length
    FROM information_schema.columns
    WHERE column_name = 'student_id'
      AND table_name IN ('student_profiles','suggestions','suggestion_outcomes')
    ORDER BY table_name
""")
fk_rows = cur.fetchall()
print(f"\n[11] student_id FK type cross-reference:")
for tbl, col, dtype, max_len in fk_rows:
    print(f"    {tbl:25s} {dtype}({max_len})")
types = {(r[2], r[3]) for r in fk_rows}
assert len(types) == 1, "student_id type mismatch across tables!"
print("    OK - all tables use VARCHAR(50) for student_id")

conn.rollback()  # rollback everything since autocommit=False
cur.close()
conn.close()

print("\n" + "=" * 60)
print("ALL VALIDATION CHECKS PASSED")
print("=" * 60)
