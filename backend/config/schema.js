import { query } from "./database.js";

// Tables added in October 2026 for the platform-level features that sit
// beside the four research components: usability survey (SUS), privacy
// consent, and the in-app notification inbox. Every statement is
// idempotent, so the account service brings an existing database up to
// date on start without a separate migration step. The same SQL is kept in
// db/migrations/002_platform_features.sql for reference.
const STATEMENTS = [
  // Webcam (emotion recognition) consent and the user's interface language.
  `ALTER TABLE core.users ADD COLUMN IF NOT EXISTS webcam_consent BOOLEAN`,
  `ALTER TABLE core.users ADD COLUMN IF NOT EXISTS webcam_consent_at TIMESTAMPTZ`,
  `ALTER TABLE core.users ADD COLUMN IF NOT EXISTS language VARCHAR(5) NOT NULL DEFAULT 'en'`,

  // One row per completed System Usability Scale questionnaire.
  `CREATE TABLE IF NOT EXISTS core.sus_responses (
     id          BIGSERIAL PRIMARY KEY,
     user_id     TEXT NOT NULL,
     role        VARCHAR(20) NOT NULL,
     answers     SMALLINT[] NOT NULL CHECK (array_length(answers, 1) = 10),
     score       NUMERIC(5,1) NOT NULL CHECK (score BETWEEN 0 AND 100),
     comment     TEXT,
     created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS sus_responses_user_idx ON core.sus_responses (user_id)`,

  // In-app inbox. dedupe_key lets a writer (a service, or the browser
  // reporting an earned badge) add the same event twice without a duplicate.
  `CREATE TABLE IF NOT EXISTS core.notifications (
     id          BIGSERIAL PRIMARY KEY,
     user_id     TEXT NOT NULL,
     kind        VARCHAR(30) NOT NULL,
     title       TEXT NOT NULL,
     body        TEXT,
     link        TEXT,
     dedupe_key  TEXT,
     created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
     read_at     TIMESTAMPTZ
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_idx ON core.notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS notifications_user_idx ON core.notifications (user_id, created_at DESC)`,
];

export async function ensureSchema() {
  for (const sql of STATEMENTS) {
    await query(sql);
  }
}
