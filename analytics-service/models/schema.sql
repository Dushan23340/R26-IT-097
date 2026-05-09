-- ============================================================
-- Student Learning Analytics Schema
-- PostgreSQL 15+
--
-- Tracks student profiles, learning sessions, learning-outcome
-- achievement scores, emotional states (from emotion detection
-- component IT22140784), and engagement metrics.
--
-- Usage:
--   psql -U postgres -d adaptive_learning_analytics -f schema.sql
-- ============================================================

-- gen_random_uuid() is available natively in PostgreSQL 13+ (no extension needed)

-- -----------------------------------------------------------
-- 1. student_profiles
--    Core directory of students.  student_id is the natural key
--    inherited from the main application (MongoDB user _id).
-- -----------------------------------------------------------
CREATE TABLE student_profiles (
    student_id      VARCHAR(50)  PRIMARY KEY,
    full_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(100) NOT NULL,
    enrollment_date DATE         NOT NULL,
    grade_level     VARCHAR(20)  NOT NULL,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Index: efficient time-range queries per student
CREATE INDEX idx_student_profiles_student_created
    ON student_profiles (student_id, created_at);

-- -----------------------------------------------------------
-- 2. learning_sessions
--    Each row represents one student–lesson interaction.
--    session_id is a UUID generated via gen_random_uuid().
-- -----------------------------------------------------------
CREATE TABLE learning_sessions (
    session_id      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      VARCHAR(50)  NOT NULL REFERENCES student_profiles(student_id) ON DELETE CASCADE,
    lesson_id       VARCHAR(50)  NOT NULL,
    lesson_title    VARCHAR(200) NOT NULL,
    start_time      TIMESTAMP    NOT NULL,
    end_time        TIMESTAMP,
    duration_seconds INTEGER     CHECK (duration_seconds >= 0),
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Index: list sessions for a student sorted by time
CREATE INDEX idx_learning_sessions_student_created
    ON learning_sessions (student_id, created_at);

-- Index: fast joins on (session_id, student_id)
CREATE INDEX idx_learning_sessions_session_student
    ON learning_sessions (session_id, student_id);

-- -----------------------------------------------------------
-- 3. lo_achievement_scores
--    Learning Outcome scores per session, categorized by
--    Bloom's taxonomy level (remember, understand, apply,
--    analyze, evaluate, create).
-- -----------------------------------------------------------
CREATE TABLE lo_achievement_scores (
    id              SERIAL       PRIMARY KEY,
    session_id      UUID         NOT NULL REFERENCES learning_sessions(session_id) ON DELETE CASCADE,
    student_id      VARCHAR(50)  NOT NULL REFERENCES student_profiles(student_id) ON DELETE CASCADE,
    lo_level        VARCHAR(20)  NOT NULL,
    score           NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
    max_score       NUMERIC(5,2) DEFAULT 100,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_lo_level CHECK (
        lo_level IN ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create')
    )
);

-- Index: time-series queries per student
CREATE INDEX idx_lo_scores_student_created
    ON lo_achievement_scores (student_id, created_at);

-- Index: fast joins on (session_id, student_id)
CREATE INDEX idx_lo_scores_session_student
    ON lo_achievement_scores (session_id, student_id);

-- -----------------------------------------------------------
-- 4. emotional_states
--    Emotion labels captured by the emotion detection component
--    (IT22140784).  Each row is one timestamped observation with
--    a confidence value between 0 and 1.
-- -----------------------------------------------------------
CREATE TABLE emotional_states (
    id              SERIAL       PRIMARY KEY,
    session_id      UUID         NOT NULL REFERENCES learning_sessions(session_id) ON DELETE CASCADE,
    student_id      VARCHAR(50)  NOT NULL REFERENCES student_profiles(student_id) ON DELETE CASCADE,
    timestamp       TIMESTAMP    NOT NULL,
    emotion_label   VARCHAR(50)  NOT NULL,
    confidence      NUMERIC(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_emotion_label CHECK (
        emotion_label IN ('happy', 'neutral', 'sad', 'angry', 'surprised', 'confused', 'bored')
    )
);

-- Index: time-series queries per student
CREATE INDEX idx_emotional_states_student_created
    ON emotional_states (student_id, created_at);

-- Index: fast joins on (session_id, student_id)
CREATE INDEX idx_emotional_states_session_student
    ON emotional_states (session_id, student_id);

-- -----------------------------------------------------------
-- 5. engagement_metrics
--    Aggregated per-session engagement indicators: overall score
--    (0–1), time on task, interaction count, and quiz attempts.
-- -----------------------------------------------------------
CREATE TABLE engagement_metrics (
    id                  SERIAL       PRIMARY KEY,
    session_id          UUID         NOT NULL REFERENCES learning_sessions(session_id) ON DELETE CASCADE,
    student_id          VARCHAR(50)  NOT NULL REFERENCES student_profiles(student_id) ON DELETE CASCADE,
    engagement_score    NUMERIC(3,2) NOT NULL CHECK (engagement_score >= 0 AND engagement_score <= 1),
    time_on_task_seconds INTEGER    NOT NULL CHECK (time_on_task_seconds >= 0),
    interaction_count   INTEGER      NOT NULL CHECK (interaction_count >= 0),
    quiz_attempts       INTEGER      NOT NULL DEFAULT 0 CHECK (quiz_attempts >= 0),
    created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Index: time-series queries per student
CREATE INDEX idx_engagement_metrics_student_created
    ON engagement_metrics (student_id, created_at);

-- Index: fast joins on (session_id, student_id)
CREATE INDEX idx_engagement_metrics_session_student
    ON engagement_metrics (session_id, student_id);
