import express from "express";
import * as userRepo from "../models/userRepository.js";
import { sendNotificationEmail } from "../services/email.js";
import { requireSelf } from "../middleware/auth.js";

const router = express.Router();

// Every route below that mutates a specific user's own data requires a
// valid JWT for that same user (requireSelf, middleware/auth.js).
// POST /notify/quiz-unlocked is the one exception - it's an internal
// service-to-service call from adaptive-learning/backend, not a
// logged-in user's own request, so there's no user token to check there.

const AVATAR_MAX_BYTES = 500 * 1024; // decoded size, keeps the Postgres row small

router.put("/:id", requireSelf, async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name && !email) {
      return res.status(400).json({ success: false, message: "name or email is required" });
    }

    const existing = await userRepo.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (email && email.toLowerCase().trim() !== existing.email) {
      const emailTaken = await userRepo.findByEmail(email);
      if (emailTaken) {
        return res.status(400).json({ success: false, message: "An account with this email already exists" });
      }
    }

    const updated = await userRepo.updateProfile(req.params.id, { name, email });
    res.json({ success: true, user: userRepo.toPublicUser(updated) });
  } catch (error) {
    console.error("❌ Update profile error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to update profile" });
  }
});

router.post("/:id/change-password", requireSelf, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "currentPassword and newPassword are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
    }

    const user = await userRepo.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isCurrentValid = await userRepo.comparePassword(currentPassword, user.password_hash);
    if (!isCurrentValid) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    await userRepo.updatePassword(req.params.id, newPassword);

    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("❌ Change password error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to change password" });
  }
});

router.put("/:id/avatar", requireSelf, async (req, res) => {
  try {
    const { avatarDataUrl } = req.body;
    if (!avatarDataUrl || !/^data:image\/(png|jpe?g|webp);base64,/.test(avatarDataUrl)) {
      return res.status(400).json({ success: false, message: "avatarDataUrl must be a base64 image data URI" });
    }
    const base64Part = avatarDataUrl.split(",")[1] || "";
    const decodedBytes = Math.floor((base64Part.length * 3) / 4);
    if (decodedBytes > AVATAR_MAX_BYTES) {
      return res.status(400).json({ success: false, message: "Avatar image is too large - resize it smaller" });
    }

    const existing = await userRepo.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const updated = await userRepo.updateAvatar(req.params.id, avatarDataUrl);
    res.json({ success: true, user: userRepo.toPublicUser(updated) });
  } catch (error) {
    console.error("❌ Update avatar error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to update avatar" });
  }
});

router.delete("/:id/avatar", requireSelf, async (req, res) => {
  try {
    const existing = await userRepo.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const updated = await userRepo.updateAvatar(req.params.id, null);
    res.json({ success: true, user: userRepo.toPublicUser(updated) });
  } catch (error) {
    console.error("❌ Remove avatar error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to remove avatar" });
  }
});

router.put("/:id/notifications", requireSelf, async (req, res) => {
  try {
    const { quizUnlocked } = req.body;
    if (typeof quizUnlocked !== "boolean") {
      return res.status(400).json({ success: false, message: "quizUnlocked (boolean) is required" });
    }

    const existing = await userRepo.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const updated = await userRepo.updateNotificationPrefs(req.params.id, { quizUnlocked });
    res.json({ success: true, user: userRepo.toPublicUser(updated) });
  } catch (error) {
    console.error("❌ Update notification preferences error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to update notification preferences" });
  }
});

// Internal ingestion point, called by adaptive-learning/backend's teacher
// unlock action (POST /api/lessons/<id>/lock) - best-effort, fire-and-
// forget from that side, same bridge pattern as analytics_bridge.py /
// adaptive_learning_bridge.py. student_ids are the platform's real
// PostgreSQL user ids (the same value used as student_id everywhere else
// in this app — was a Mongo ObjectId string before this migration, and
// still is that exact same string value for every pre-existing account).
router.post("/notify/quiz-unlocked", async (req, res) => {
  try {
    const { student_ids: studentIds, lesson_title: lessonTitle } = req.body;
    if (!Array.isArray(studentIds) || !lessonTitle) {
      return res.status(400).json({ success: false, message: "student_ids (array) and lesson_title are required" });
    }

    const users = await userRepo.findManyByIdsWithQuizNotificationsOn(studentIds);

    let sent = 0;
    for (const user of users) {
      await sendNotificationEmail(
        user.email,
        `Quiz unlocked: ${lessonTitle}`,
        `Hi ${user.name}, your teacher has unlocked the quiz for "${lessonTitle}". You can take it now on AdaptiveMind.`
      );
      sent += 1;
    }

    res.json({ success: true, notified: sent, eligible: users.length });
  } catch (error) {
    console.error("❌ quiz-unlocked notify error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to send notifications" });
  }
});

export default router;
