-- Platform features (October 2026): SUS survey, webcam consent, language,
-- in-app notifications. Applied automatically by config/schema.js on start.

ALTER TABLE core.users ADD COLUMN IF NOT EXISTS webcam_consent BOOLEAN;

ALTER TABLE core.users ADD COLUMN IF NOT EXISTS webcam_consent_at TIMESTAMPTZ;

ALTER TABLE core.users ADD COLUMN IF NOT EXISTS language VARCHAR(5) NOT NULL DEFAULT 'en';

CREATE TABLE IF NOT EXISTS core.sus_responses (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL,
  role        VARCHAR(20) NOT NULL,
  answers     SMALLINT[] NOT NULL CHECK (array_length(answers, 1) = 10),
  score       NUMERIC(5,1) NOT NULL CHECK (score BETWEEN 0 AND 100),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
   );

CREATE INDEX IF NOT EXISTS sus_responses_user_idx ON core.sus_responses (user_id);

CREATE TABLE IF NOT EXISTS core.notifications (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL,
  kind        VARCHAR(30) NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  link        TEXT,
  dedupe_key  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at     TIMESTAMPTZ
   );

CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_idx ON core.notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS notifications_user_idx ON core.notifications (user_id, created_at DESC);
