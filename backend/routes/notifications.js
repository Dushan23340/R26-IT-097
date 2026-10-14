import express from "express";
import { query } from "../config/database.js";
import { requireAuth, requireInternal } from "../middleware/auth.js";
import { KINDS, notify, toPublicNotification } from "../services/notifications.js";

const router = express.Router();

// Only in-app paths may be stored as links ("/lessons", "/profile?tab=..."),
// so a notification can never point the user at another site or a
// javascript: URL.
function safeLink(link) {
  return typeof link === "string" && /^\/(?!\/)[\w\-./?=&%#]*$/.test(link) ? link : null;
}

// Kinds the user's own browser may add: events it works out from data the
// user already sees (a badge earned, a recommendation approved, a teacher
// broadcast). Everything else is written by the services themselves.
const SELF_KINDS = ["badge", "recommendation", "message"];

// GET /api/notifications - newest first, plus the unread count for the bell.
router.get("/", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    const [list, unread] = await Promise.all([
      query("SELECT * FROM core.notifications WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2", [req.user.userId, limit]),
      query("SELECT count(*)::int AS n FROM core.notifications WHERE user_id = $1 AND read_at IS NULL", [req.user.userId]),
    ]);
    res.json({ success: true, notifications: list.rows.map(toPublicNotification), unread: unread.rows[0].n });
  } catch (error) {
    console.error("❌ List notifications error:", error);
    res.status(500).json({ success: false, message: "Could not load notifications" });
  }
});

// POST /api/notifications/read  { ids: ["1","2"] } or { all: true }
router.post("/read", requireAuth, async (req, res) => {
  try {
    const { ids, all } = req.body || {};
    if (all) {
      await query("UPDATE core.notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL", [req.user.userId]);
    } else if (Array.isArray(ids) && ids.length) {
      await query(
        "UPDATE core.notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL AND id = ANY($2::bigint[])",
        [req.user.userId, ids.map(Number).filter(Number.isFinite)]
      );
    } else {
      return res.status(400).json({ success: false, message: "Send ids or all: true" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Mark read error:", error);
    res.status(500).json({ success: false, message: "Could not update notifications" });
  }
});

// DELETE /api/notifications/:id - remove one of your own notifications.
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await query("DELETE FROM core.notifications WHERE user_id = $1 AND id = $2", [req.user.userId, Number(req.params.id) || 0]);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Delete notification error:", error);
    res.status(500).json({ success: false, message: "Could not delete the notification" });
  }
});

// POST /api/notifications/self - the browser reports an event it derived.
router.post("/self", requireAuth, async (req, res) => {
  try {
    const { kind, title, body, link, dedupeKey } = req.body || {};
    if (!SELF_KINDS.includes(kind) || !title || !dedupeKey) {
      return res.status(400).json({ success: false, message: `kind (${SELF_KINDS.join("/")}), title and dedupeKey are required` });
    }
    const row = await notify(req.user.userId, { kind, title, body, link: safeLink(link), dedupeKey: `${kind}:${String(dedupeKey).slice(0, 120)}` });
    res.json({ success: true, created: Boolean(row) });
  } catch (error) {
    console.error("❌ Self notification error:", error);
    res.status(500).json({ success: false, message: "Could not save the notification" });
  }
});

// POST /api/notifications/internal - another service notifies users.
// { user_ids: [...], kind, title, body?, link?, dedupe_key? }
router.post("/internal", requireInternal, async (req, res) => {
  try {
    const { user_ids: userIds, kind, title, body, link, dedupe_key: dedupeKey } = req.body || {};
    if (!Array.isArray(userIds) || !KINDS.includes(kind) || !title) {
      return res.status(400).json({ success: false, message: "user_ids (array), kind and title are required" });
    }
    let created = 0;
    for (const userId of userIds.slice(0, 500)) {
      const row = await notify(String(userId), { kind, title, body, link: safeLink(link), dedupeKey: dedupeKey || null });
      if (row) created += 1;
    }
    res.json({ success: true, created });
  } catch (error) {
    console.error("❌ Internal notification error:", error);
    res.status(500).json({ success: false, message: "Could not save notifications" });
  }
});

export default router;
