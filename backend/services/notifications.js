import { query } from "../config/database.js";

// The in-app inbox (core.notifications). Writers: this service itself
// (welcome, security notices, quiz unlocked), other services through the
// internal route, and the signed-in user's own browser for events it
// derives (badges earned, recommendations approved) - those carry a
// dedupe_key so reporting the same event again changes nothing.
export const KINDS = ["welcome", "security", "quiz_unlocked", "recommendation", "badge", "message", "survey", "system"];

export async function notify(userId, { kind, title, body = null, link = null, dedupeKey = null }) {
  if (!userId || !KINDS.includes(kind) || !title) return null;
  const { rows } = await query(
    `INSERT INTO core.notifications (user_id, kind, title, body, link, dedupe_key)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
     RETURNING *`,
    [userId, kind, String(title).slice(0, 200), body ? String(body).slice(0, 1000) : null, link, dedupeKey]
  );
  return rows[0] || null;
}

// Fire-and-forget variant for places where the inbox is a side effect and
// must never fail the main request (sign-up, password change, ...).
export function notifySafe(userId, notification) {
  notify(userId, notification).catch((err) => console.error("⚠️ Notification not saved:", err.message));
}

export function toPublicNotification(row) {
  return {
    id: String(row.id),
    kind: row.kind,
    title: row.title,
    body: row.body,
    link: row.link,
    createdAt: row.created_at,
    read: Boolean(row.read_at),
  };
}
