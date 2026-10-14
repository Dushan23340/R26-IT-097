import express from "express";
import { query } from "../config/database.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { notifySafe } from "../services/notifications.js";

const router = express.Router();

// System Usability Scale (Brooke, 1996): ten 1-5 Likert items. Odd items are
// positive (score - 1), even items negative (5 - score); the sum x 2.5 gives
// 0-100. Each user's most recent answer is the one that counts in the
// summary, so retaking it updates rather than double-counts.
export function susScore(answers) {
  return answers.reduce((sum, a, i) => sum + (i % 2 === 0 ? a - 1 : 5 - a), 0) * 2.5;
}

// Bangor, Kortum & Miller (2009) adjective scale and acceptability ranges.
export function susAdjective(score) {
  if (score > 85) return "Excellent";
  if (score > 72) return "Good";
  if (score > 52) return "OK";
  if (score > 38) return "Poor";
  return "Awful";
}
export function susAcceptability(score) {
  if (score >= 70) return "Acceptable";
  if (score >= 50) return "Marginal";
  return "Not acceptable";
}

function stats(scores) {
  const n = scores.length;
  if (!n) return { n: 0, mean: null, sd: null, median: null, min: null, max: null, ci95: null };
  const mean = scores.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(scores.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  const sorted = [...scores].sort((a, b) => a - b);
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  // t critical value for small samples (two-sided 95%), normal beyond 30.
  const T = [0, 12.71, 4.3, 3.18, 2.78, 2.57, 2.45, 2.36, 2.31, 2.26, 2.23, 2.2, 2.18, 2.16, 2.14, 2.13, 2.12, 2.11, 2.1, 2.09, 2.09, 2.08, 2.07, 2.07, 2.06, 2.06, 2.06, 2.05, 2.05, 2.05, 2.04];
  const t = n - 1 < T.length ? T[n - 1] : 1.96;
  const half = n > 1 ? (t * sd) / Math.sqrt(n) : null;
  const r = (x) => (x == null ? null : Math.round(x * 10) / 10);
  return {
    n,
    mean: r(mean),
    sd: r(sd),
    median: r(median),
    min: r(sorted[0]),
    max: r(sorted[n - 1]),
    ci95: half == null ? null : [r(Math.max(0, mean - half)), r(Math.min(100, mean + half))],
  };
}

// Latest response per user.
const LATEST = `SELECT DISTINCT ON (user_id) * FROM core.sus_responses ORDER BY user_id, created_at DESC`;

// GET /api/feedback/sus/mine - has this user answered yet?
router.get("/sus/mine", requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT score, created_at FROM core.sus_responses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
      [req.user.userId]
    );
    res.json({ success: true, submitted: rows.length > 0, score: rows[0] ? Number(rows[0].score) : null, submittedAt: rows[0]?.created_at || null });
  } catch (error) {
    console.error("❌ SUS mine error:", error);
    res.status(500).json({ success: false, message: "Could not load your survey status" });
  }
});

// POST /api/feedback/sus  { answers: [10 x 1..5], comment? }
router.post("/sus", requireAuth, async (req, res) => {
  try {
    const { answers, comment } = req.body || {};
    if (!Array.isArray(answers) || answers.length !== 10 || !answers.every((a) => Number.isInteger(a) && a >= 1 && a <= 5)) {
      return res.status(400).json({ success: false, message: "Answer all 10 statements (1 to 5)." });
    }
    const cleanComment = typeof comment === "string" && comment.trim() ? comment.trim().slice(0, 1000) : null;
    const score = susScore(answers);
    await query(
      "INSERT INTO core.sus_responses (user_id, role, answers, score, comment) VALUES ($1, $2, $3, $4, $5)",
      [req.user.userId, req.user.role, answers, score, cleanComment]
    );
    notifySafe(req.user.userId, {
      kind: "survey",
      title: "Thank you for your feedback",
      body: "Your answers help us measure how easy AdaptiveMind is to use.",
      dedupeKey: "survey:thanks",
    });
    res.status(201).json({ success: true, score, adjective: susAdjective(score) });
  } catch (error) {
    console.error("❌ SUS submit error:", error);
    res.status(500).json({ success: false, message: "Could not save your answers" });
  }
});

// GET /api/feedback/sus/summary - teachers only.
router.get("/sus/summary", requireRole("teacher"), async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM (${LATEST}) latest ORDER BY created_at DESC`);
    const all = rows.map((r) => ({ ...r, score: Number(r.score) }));
    const overall = stats(all.map((r) => r.score));
    const byRole = Object.fromEntries(
      ["student", "teacher"].map((role) => [role, stats(all.filter((r) => r.role === role).map((r) => r.score))])
    );
    // Mean of each item on its own 1-5 scale, so weak spots stand out.
    const itemMeans = Array.from({ length: 10 }, (_, i) =>
      all.length ? Math.round((all.reduce((s, r) => s + Number(r.answers[i]), 0) / all.length) * 100) / 100 : null
    );
    const buckets = [
      ["0-38", 0, 38],
      ["38-52", 38, 52],
      ["52-72", 52, 72],
      ["72-85", 72, 85],
      ["85-100", 85, 100.1],
    ].map(([label, lo, hi]) => ({ label, count: all.filter((r) => r.score >= lo && r.score < hi).length }));
    res.json({
      success: true,
      overall: { ...overall, adjective: overall.mean == null ? null : susAdjective(overall.mean), acceptability: overall.mean == null ? null : susAcceptability(overall.mean) },
      byRole,
      itemMeans,
      buckets,
      benchmark: 68,
      comments: all.filter((r) => r.comment).slice(0, 20).map((r) => ({ role: r.role, score: r.score, comment: r.comment, at: r.created_at })),
      totalSubmissions: (await query("SELECT count(*)::int AS n FROM core.sus_responses")).rows[0].n,
    });
  } catch (error) {
    console.error("❌ SUS summary error:", error);
    res.status(500).json({ success: false, message: "Could not load the survey results" });
  }
});

// GET /api/feedback/sus/export.csv - teachers only. Participants are
// numbered (P01, P02, ...), never named, so the file can go in a report.
router.get("/sus/export.csv", requireRole("teacher"), async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM (${LATEST}) latest ORDER BY created_at`);
    const esc = (v) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const lines = [["participant", "role", "q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10", "sus_score", "submitted_at", "comment"].join(",")];
    rows.forEach((r, i) => {
      lines.push([`P${String(i + 1).padStart(2, "0")}`, r.role, ...r.answers, Number(r.score), new Date(r.created_at).toISOString(), r.comment].map(esc).join(","));
    });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="adaptivemind-sus-results.csv"');
    res.send(lines.join("\n") + "\n");
  } catch (error) {
    console.error("❌ SUS export error:", error);
    res.status(500).json({ success: false, message: "Could not export the survey results" });
  }
});

export default router;
