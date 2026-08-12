-- ============================================================
-- Evidence-Reasoned Suggestion Engine (ERSE) Schema
-- PostgreSQL 15+
--
-- Extends the core analytics schema with ERSE suggestion
-- generation, teacher review, and outcome-tracking tables.
--
-- Depends on: student_profiles, learning_sessions
--             (defined in schema.sql)
--
-- Usage:
--   psql -U postgres -d adaptive_learning_analytics \
--        -f suggestion_schema.sql
-- ============================================================

-- -----------------------------------------------------------
-- 1. suggestions
--    Each row is a personalised learning suggestion generated
--    by the ERSE engine for a specific student.  The LLM
--    composes teacher- and student-facing text backed by a
--    structured evidence array (JSONB).  Teachers review
--    suggestions and may approve, modify, or dismiss them.
--    state_vector captures the student snapshot at generation
--    time so suggestions are reproducible and auditable.
-- -----------------------------------------------------------
CREATE TABLE suggestions (
    suggestion_id       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id          VARCHAR(50)   NOT NULL REFERENCES student_profiles(student_id) ON DELETE CASCADE,

    -- Pattern identification
    pattern_name        VARCHAR(100)  NOT NULL,
    pattern_priority    SMALLINT      NOT NULL CHECK (pattern_priority BETWEEN 1 AND 8),

    -- Confidence & urgency classification
    confidence          VARCHAR(10)   CHECK (confidence IN ('High', 'Medium', 'Low')),
    urgency             VARCHAR(15)   CHECK (urgency IN ('Immediate', 'Monitor', 'Routine')),
    confidence_score    NUMERIC(4,3),

    -- Suggestion text
    teacher_suggestion  TEXT          NOT NULL,
    student_suggestion  TEXT          NOT NULL,
    expected_outcome    TEXT          NOT NULL,

    -- Evidence & state (JSONB for flexible structured data)
    evidence            JSONB         DEFAULT '[]',
    state_vector        JSONB         DEFAULT '{}',

    -- Teacher review workflow
    status              VARCHAR(15)   DEFAULT 'pending'
                                       CHECK (status IN ('pending', 'approved', 'modified', 'dismissed')),
    modified_suggestion TEXT,
    teacher_notes       TEXT,
    reviewed_at         TIMESTAMP,
    reviewed_by         VARCHAR(100),

    -- LLM provenance
    llm_model           VARCHAR(100),
    llm_used            BOOLEAN       DEFAULT TRUE,

    -- Outcome tracking
    outcome_tracked     BOOLEAN       DEFAULT FALSE,
    outcome_summary     TEXT,

    -- LO forwarding
    forwarded_to_lo     BOOLEAN       DEFAULT FALSE,
    forwarded_at        TIMESTAMP,

    -- Timestamps
    created_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- Index: list suggestions for a student, newest first
CREATE INDEX idx_suggestions_student_created
    ON suggestions (student_id, created_at DESC);

-- Index: filter by review status (pending queue)
CREATE INDEX idx_suggestions_status
    ON suggestions (status);

-- Index: filter by pattern name (e.g., all "Declining Trend" suggestions)
CREATE INDEX idx_suggestions_pattern_name
    ON suggestions (pattern_name);

-- Index: filter by priority for triage views
CREATE INDEX idx_suggestions_priority
    ON suggestions (pattern_priority);

-- Index: fast lookup of un-tracked suggestions for batch outcome processing
CREATE INDEX idx_suggestions_outcome_tracked
    ON suggestions (outcome_tracked)
    WHERE outcome_tracked = FALSE;

-- Index: fast lookup of un-forwarded suggestions for LO batch processing
CREATE INDEX idx_suggestions_forwarded_to_lo
    ON suggestions (forwarded_to_lo)
    WHERE forwarded_to_lo = FALSE;

-- GIN index: query inside the evidence JSONB array
CREATE INDEX idx_suggestions_evidence_gin
    ON suggestions USING GIN (evidence);

-- GIN index: query inside the state_vector JSONB object
CREATE INDEX idx_suggestions_state_vector_gin
    ON suggestions USING GIN (state_vector);

-- -----------------------------------------------------------
-- Trigger: auto-update updated_at on row modification
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_suggestions_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    -- clock_timestamp() returns the actual wall-clock time,
    -- unlike CURRENT_TIMESTAMP which returns the transaction start.
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_suggestions_updated_at
    BEFORE UPDATE ON suggestions
    FOR EACH ROW
    EXECUTE FUNCTION fn_suggestions_set_updated_at();

-- -----------------------------------------------------------
-- 2. suggestion_outcomes
--    Tracks the learning outcome after a suggestion is
--    applied.  Each row links a suggestion to a specific
--    follow-up session, recording the LO score delta and
--    whether the student's behavioural pattern changed.
--    The UNIQUE constraint prevents duplicate tracking of
--    the same suggestion–session pair.
-- -----------------------------------------------------------
CREATE TABLE suggestion_outcomes (
    outcome_id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    suggestion_id       UUID          NOT NULL REFERENCES suggestions(suggestion_id) ON DELETE CASCADE,
    session_id          UUID          NOT NULL REFERENCES learning_sessions(session_id) ON DELETE CASCADE,
    student_id          VARCHAR(50)   NOT NULL REFERENCES student_profiles(student_id),

    -- LO score comparison (baseline = before suggestion, session = after)
    lo_score_baseline   NUMERIC(5,2),
    lo_score_session    NUMERIC(5,2),
    lo_delta            NUMERIC(6,2)  GENERATED ALWAYS AS (lo_score_session - lo_score_baseline) STORED,

    -- Position of the follow-up session in the student's timeline
    session_index       SMALLINT      NOT NULL CHECK (session_index >= 1),

    -- Pattern evolution tracking
    pattern_changed     BOOLEAN       DEFAULT FALSE,
    new_pattern         VARCHAR(100),

    -- Engagement during the follow-up session
    engagement_score    NUMERIC(3,2),

    created_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,

    -- Prevent duplicate outcome tracking for the same suggestion + session
    CONSTRAINT uq_suggestion_outcome UNIQUE (suggestion_id, session_id)
);

-- Index: list outcomes for a specific suggestion (audit trail)
CREATE INDEX idx_suggestion_outcomes_suggestion
    ON suggestion_outcomes (suggestion_id);

-- Index: list outcomes for a student, newest first
CREATE INDEX idx_suggestion_outcomes_student_created
    ON suggestion_outcomes (student_id, created_at DESC);

-- Index: filter by session for join queries
CREATE INDEX idx_suggestion_outcomes_session
    ON suggestion_outcomes (session_id);

-- Index: find outcomes where the student's pattern changed
CREATE INDEX idx_suggestion_outcomes_pattern_changed
    ON suggestion_outcomes (pattern_changed)
    WHERE pattern_changed = TRUE;
