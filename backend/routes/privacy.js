import express from "express";
import { query } from "../config/database.js";
import { requireAuth } from "../middleware/auth.js";
import * as userRepo from "../models/userRepository.js";
import { notifySafe, toPublicNotification } from "../services/notifications.js";
import { PEERS, internalHeaders, probe } from "../services/peers.js";

const router = express.Router();

// Learning records analytics-service keeps in the shared database, keyed by
// the student's account id. Every table cascades from student_profiles, so
// deleting that one row removes the rest (see analytics-service/models).
const ANALYTICS_TABLES = [
  "student_profiles",
  "learning_sessions",
  "lo_achievement_scores",
  "emotional_states",
  "engagement_metrics",
  "recommendations",
  "intervention_outcomes",
];

// PUT /api/privacy/consent  { webcam: true | false }
// Asked before a student's first live class. "false" means the class still
// works, but the webcam is never switched on.
router.put("/consent", requireAuth, async (req, res) => {
  try {
    const { webcam } = req.body || {};
    if (typeof webcam !== "boolean") {
      return res.status(400).json({ success: false, message: "webcam must be true or false" });
    }
    const updated = await userRepo.setWebcamConsent(req.user.userId, webcam);
    if (!updated) return res.status(404).json({ success: false, message: "User not found" });
    notifySafe(req.user.userId, {
      kind: "security",
      title: webcam ? "Webcam consent given" : "Webcam consent withdrawn",
      body: webcam
        ? "Your webcam will be used during live classes to read how the lesson is going for you. You can withdraw this at any time in Profile → Privacy."
        : "Your webcam will not be switched on in live classes. You can still join them.",
      link: "/profile?tab=privacy",
    });
    res.json({ success: true, user: userRepo.toPublicUser(updated) });
  } catch (error) {
    console.error("❌ Consent error:", error);
    res.status(500).json({ success: false, message: "Could not save your choice" });
  }
});

// What is stored about the signed-in user, in every service.
async function collect(userId) {
  const user = await userRepo.findById(userId);
  if (!user) return null;
  const analytics = {};
  for (const table of ANALYTICS_TABLES) {
    const { rows } = await query(`SELECT * FROM public.${table} WHERE student_id = $1`, [userId]);
    analytics[table] = rows;
  }
  const [notifications, survey] = await Promise.all([
    query("SELECT * FROM core.notifications WHERE user_id = $1 ORDER BY created_at DESC", [userId]),
    query("SELECT answers, score, comment, created_at FROM core.sus_responses WHERE user_id = $1 ORDER BY created_at DESC", [userId]),
  ]);
  const adaptive = await probe(`${PEERS.adaptive.url()}/api/students/${encodeURIComponent(userId)}/data`, { headers: internalHeaders() });
  return {
    user,
    sections: {
      account: { ...userRepo.toPublicUser(user), isEmailVerified: user.is_email_verified, updatedAt: user.updated_at },
      quiz_and_emotion_history: analytics,
      lesson_progress: adaptive.ok ? adaptive.body?.data : { unavailable: "The adaptive learning service could not be reached." },
      notifications: notifications.rows.map(toPublicNotification),
      usability_survey: survey.rows,
    },
    adaptiveReachable: adaptive.ok,
  };
}

// GET /api/privacy/summary - counts per category for the privacy page.
router.get("/summary", requireAuth, async (req, res) => {
  try {
    const data = await collect(req.user.userId);
    if (!data) return res.status(404).json({ success: false, message: "User not found" });
    const a = data.sections.quiz_and_emotion_history;
    const p = data.sections.lesson_progress || {};
    res.json({
      success: true,
      webcamConsent: data.user.webcam_consent ?? null,
      webcamConsentAt: data.user.webcam_consent_at,
      counts: {
        quizSessions: a.learning_sessions.length,
        loScores: a.lo_achievement_scores.length,
        emotionReadings: a.emotional_states.length,
        recommendations: a.recommendations.length + (p.advisor_recommendations?.length || 0),
        liveClasses: p.live_class_attendance?.length || 0,
        notifications: data.sections.notifications.length,
        surveys: data.sections.usability_survey.length,
      },
      adaptiveReachable: data.adaptiveReachable,
    });
  } catch (error) {
    console.error("❌ Privacy summary error:", error);
    res.status(500).json({ success: false, message: "Could not load your data summary" });
  }
});

// GET /api/privacy/export - a JSON file with everything above.
router.get("/export", requireAuth, async (req, res) => {
  try {
    const data = await collect(req.user.userId);
    if (!data) return res.status(404).json({ success: false, message: "User not found" });
    const file = {
      exported_at: new Date().toISOString(),
      platform: "AdaptiveMind (R26-IT-097)",
      notes: [
        "Face images are not saved to disk or to any database. During a live class only your most recent face crop is held in the emotion service's memory (for your teacher's live view) and it is replaced every few seconds; what is stored is the emotion label.",
        "Live-class readings held by the class emotion service use a pseudonym, not your account id. The copies linked to you are in quiz_and_emotion_history.emotional_states.",
        "Your password is stored only as a bcrypt hash and is not included.",
      ],
      ...data.sections,
    };
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="adaptivemind-my-data-${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(JSON.stringify(file, null, 2));
  } catch (error) {
    console.error("❌ Privacy export error:", error);
    res.status(500).json({ success: false, message: "Could not prepare your data" });
  }
});

// DELETE /api/privacy/data  { scope: "learning" | "account", password }
//   learning - quiz results, emotion readings, recommendations, lesson
//              progress and live-class attendance. The account stays.
//   account  - all of the above, then the account itself.
// The password is asked again so a borrowed, signed-in laptop can't erase
// someone's history.
router.delete("/data", requireAuth, async (req, res) => {
  try {
    const { scope, password } = req.body || {};
    if (!["learning", "account"].includes(scope)) {
      return res.status(400).json({ success: false, message: 'scope must be "learning" or "account"' });
    }
    const user = await userRepo.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (!password || !(await userRepo.comparePassword(password, user.password_hash))) {
      return res.status(401).json({ success: false, message: "Password is incorrect" });
    }

    // The adaptive service first: if it is down, nothing has been deleted
    // yet and the user can simply try again.
    const adaptive = await probe(`${PEERS.adaptive.url()}/api/students/${encodeURIComponent(user.id)}/data`, {
      method: "DELETE",
      headers: internalHeaders(),
    });
    if (!adaptive.ok) {
      return res.status(503).json({ success: false, message: "The adaptive learning service is not reachable, so nothing was deleted. Please try again in a moment." });
    }
    const analytics = await query("DELETE FROM public.student_profiles WHERE student_id = $1", [user.id]);

    if (scope === "account") {
      await query("DELETE FROM core.notifications WHERE user_id = $1", [user.id]);
      await query("DELETE FROM core.sus_responses WHERE user_id = $1", [user.id]);
      await userRepo.deleteUser(user.id);
      console.log(`🗑️  Account and data deleted for user ${user.id}`);
      return res.json({ success: true, scope, accountDeleted: true });
    }

    notifySafe(user.id, {
      kind: "security",
      title: "Your learning data was deleted",
      body: "Quiz results, emotion readings, recommendations and lesson progress were removed at your request. Your account is still active.",
      link: "/profile?tab=privacy",
    });
    console.log(`🗑️  Learning data deleted for user ${user.id}`);
    res.json({ success: true, scope, removed: { analyticsProfile: analytics.rowCount, lessonProgress: adaptive.body?.removed || {} } });
  } catch (error) {
    console.error("❌ Privacy delete error:", error);
    res.status(500).json({ success: false, message: "Could not delete your data" });
  }
});

export default router;
