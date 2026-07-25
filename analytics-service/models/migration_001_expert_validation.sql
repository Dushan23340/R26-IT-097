-- ============================================================
-- Migration 001: Expert-in-the-Loop + Fairness Auditing support
--
-- The original schema.sql (SO1) covers persistent profile storage but is
-- missing two things the same proposal's SO4/SO5 depend on:
--   - student_profiles.demographic_group: shown in Figure 1's ER diagram
--     but absent from the actual CREATE TABLE statement. Needed for the
--     disparate-impact fairness audit (FR09).
--   - a recommendations table: the expert-in-the-loop validation workflow
--     (Figure 3, FR08) needs somewhere to queue AI-generated
--     recommendations for teacher/advisor approve/modify/reject before
--     they reach the Learning Outcome Component.
--   - learning_sessions.difficulty: needed for the lesson
--     difficulty-vs-achievement regression described in 3.2.2.
--
-- Additive and idempotent - safe to run against a DB that already has
-- schema.sql applied.
-- ============================================================

-- The original schema's emotion_label vocabulary (happy/neutral/sad/angry/
-- surprised/confused/bored) doesn't match the shared platform vocabulary
-- used everywhere else (emotion-backend's EmotionType enum: HAPPY/NORMAL/
-- CONFUSED/BORED/FRUSTRATED/ANGRY) - it's missing "frustrated" entirely and
-- has three labels ("neutral" vs "normal", "sad", "surprised") that don't
-- exist anywhere in this platform's actual emotion pipeline.
ALTER TABLE emotional_states DROP CONSTRAINT IF EXISTS chk_emotion_label;
ALTER TABLE emotional_states ADD CONSTRAINT chk_emotion_label
    CHECK (emotion_label IN ('happy', 'normal', 'confused', 'bored', 'frustrated', 'angry'));

ALTER TABLE student_profiles
    ADD COLUMN IF NOT EXISTS demographic_group VARCHAR(50);

ALTER TABLE learning_sessions
    ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20)
        CHECK (difficulty IN ('easy', 'medium', 'hard'));

CREATE TABLE IF NOT EXISTS recommendations (
    id              SERIAL       PRIMARY KEY,
    student_id      VARCHAR(50)  NOT NULL REFERENCES student_profiles(student_id) ON DELETE CASCADE,
    session_id      UUID         REFERENCES learning_sessions(session_id) ON DELETE SET NULL,
    insight_type    VARCHAR(30)  NOT NULL
        CHECK (insight_type IN ('trend', 'stability', 'emotion_correlation', 'engagement_comparison')),
    recommendation_text TEXT     NOT NULL,
    statistical_evidence JSONB   NOT NULL DEFAULT '{}',
    status          VARCHAR(20)  NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'modified', 'rejected')),
    modified_text   TEXT,
    reviewed_by     VARCHAR(100),
    reviewed_at     TIMESTAMP,
    rejection_rationale TEXT,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recommendations_student_status
    ON recommendations (student_id, status);

CREATE INDEX IF NOT EXISTS idx_recommendations_status_created
    ON recommendations (status, created_at);
