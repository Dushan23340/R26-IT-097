-- ============================================================
-- Migration 002: Intervention Outcome Tracking + Fairness Alerts
--
-- Closes two gaps left after migration_001's expert-in-the-loop workflow:
--   - Approving a recommendation had nowhere to go (Figure 3's "forwarded
--     to Learning Outcome Component" step wasn't implemented) and nothing
--     ever checked whether an approved recommendation actually helped
--     (SO5: "evaluates the quality of implemented suggestions through
--     outcome tracking").
--   - fairness_service.py computes disparate-impact/variance-calibration
--     violations but never persists them - a violation is only visible if
--     someone happens to call that endpoint at the right moment, not a
--     real "alert" (FR09: "flag bias indicators exceeding configurable
--     thresholds").
--
-- Additive and idempotent - safe to run against a DB that already has
-- schema.sql + migration_001 applied.
-- ============================================================

ALTER TABLE recommendations
    ADD COLUMN IF NOT EXISTS lesson_id VARCHAR(50);

-- -----------------------------------------------------------
-- intervention_outcomes
--   One row per approved/modified recommendation, created at review time
--   with pre_score already known, resolved reactively (by
--   routes/profiles.py's session/LO-score ingestion) once the student's
--   next session for the same lesson lands.
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS intervention_outcomes (
    id                  SERIAL       PRIMARY KEY,
    recommendation_id   INTEGER      NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
    student_id          VARCHAR(50)  NOT NULL REFERENCES student_profiles(student_id) ON DELETE CASCADE,
    lesson_id           VARCHAR(50)  NOT NULL,

    pre_session_id      UUID         NOT NULL REFERENCES learning_sessions(session_id) ON DELETE CASCADE,
    pre_score           NUMERIC(5,2) NOT NULL,

    post_session_id     UUID         REFERENCES learning_sessions(session_id) ON DELETE SET NULL,
    post_score          NUMERIC(5,2),

    outcome             VARCHAR(25)  NOT NULL DEFAULT 'pending'
        CHECK (outcome IN ('pending', 'improved', 'no_significant_change', 'declined')),

    created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    evaluated_at         TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_intervention_outcomes_student_lesson_pending
    ON intervention_outcomes (student_id, lesson_id, outcome);

CREATE INDEX IF NOT EXISTS idx_intervention_outcomes_recommendation
    ON intervention_outcomes (recommendation_id);

-- -----------------------------------------------------------
-- fairness_audits
--   One row per computed fairness check that came back OUT of the
--   acceptable range - a real, queryable alert history instead of a
--   value that only ever existed inside one API response.
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS fairness_audits (
    id              SERIAL       PRIMARY KEY,
    metric          VARCHAR(30)  NOT NULL
        CHECK (metric IN ('disparate_impact', 'variance_calibration')),
    groups_compared JSONB        NOT NULL,
    metric_values   JSONB        NOT NULL,
    threshold       JSONB        NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'reviewed')),
    reviewed_by     VARCHAR(100),
    reviewed_at     TIMESTAMP,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fairness_audits_status_created
    ON fairness_audits (status, created_at);
