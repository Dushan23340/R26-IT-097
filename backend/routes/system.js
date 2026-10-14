import express from "express";
import { query } from "../config/database.js";
import { requireRole } from "../middleware/auth.js";
import { isEmailConfigured } from "../services/email.js";
import { PEERS, probe } from "../services/peers.js";

const router = express.Router();
const startedAt = Date.now();

// What each health body can tell us beyond "it answered".
function details(key, body) {
  if (!body || typeof body !== "object") return [];
  switch (key) {
    case "emotionService":
      return [
        { label: "Emotion model loaded", ok: body.modelLoaded === true },
        ...(body.faceLandmarkerLoaded !== undefined ? [{ label: "Face landmarker loaded", ok: body.faceLandmarkerLoaded === true }] : []),
      ];
    case "analytics":
      return [{ label: "Database connected", ok: body.database_connected === true }];
    case "adaptive":
    case "classEmotion":
      return body.version ? [{ label: `Version ${body.version}`, ok: true }] : [];
    default:
      return [];
  }
}

// GET /api/system/status - teachers only. Each service is checked from here
// (server side), so the page also works through the public tunnel link,
// where the browser cannot reach the services' own ports.
router.get("/status", requireRole("teacher"), async (req, res) => {
  const checks = await Promise.all(
    Object.entries(PEERS).map(async ([key, peer]) => {
      const result = await probe(`${peer.url()}${peer.health}`, { json: key !== "objectStorage" });
      const items = details(key, result.body);
      const degraded = result.ok && items.some((i) => !i.ok);
      return {
        key,
        name: peer.name,
        owner: peer.owner,
        status: !result.ok ? "down" : degraded ? "degraded" : "up",
        ms: result.ms,
        httpStatus: result.status,
        error: result.error || (!result.ok && result.status ? `HTTP ${result.status}` : null),
        details: items,
      };
    })
  );

  // This service and its database.
  const dbStarted = performance.now();
  let dbOk = true;
  try {
    await query("SELECT 1");
  } catch {
    dbOk = false;
  }
  const dbMs = Math.round(performance.now() - dbStarted);
  const account = {
    key: "account",
    name: "Accounts & sign-in",
    owner: "Shared",
    status: dbOk ? "up" : "degraded",
    ms: dbMs,
    httpStatus: 200,
    error: null,
    details: [
      { label: "PostgreSQL connected", ok: dbOk },
      { label: isEmailConfigured() ? "E-mail sending configured" : "E-mail not configured (codes go to the server log)", ok: isEmailConfigured() },
      { label: process.env.SERVICE_AUTH_ENABLED === "false" ? "Service token checks OFF" : "Service token checks on", ok: process.env.SERVICE_AUTH_ENABLED !== "false" },
    ],
  };

  const services = [account, ...checks];
  const counts = services.reduce((acc, s) => ({ ...acc, [s.status]: (acc[s.status] || 0) + 1 }), {});
  res.json({
    success: true,
    checkedAt: new Date().toISOString(),
    overall: counts.down ? "down" : counts.degraded ? "degraded" : "up",
    counts,
    accountServiceUptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    services,
  });
});

export default router;
