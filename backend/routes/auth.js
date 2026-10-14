import express from "express";
import * as userRepo from "../models/userRepository.js";
import crypto from "crypto";
import {
  generateToken,
  generateOtp,
  OTP_EXPIRATION_MINUTES,
  MAX_OTP_ATTEMPTS,
  MIN_OTP_REQUEST_INTERVAL_SECONDS,
} from "../utils/jwt.js";
import { isEmailConfigured, sendOtpEmail } from "../services/email.js";
import { notifySafe } from "../services/notifications.js";

const router = express.Router();

// New accounts must verify their e-mail when the server can actually send
// e-mail (SMTP_USER/SMTP_PASS set). Without it the code could never reach
// the user, so sign-up stays immediate. EMAIL_VERIFICATION_REQUIRED=true or
// =false overrides this either way.
function verificationRequired() {
  const flag = (process.env.EMAIL_VERIFICATION_REQUIRED || "").toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return isEmailConfigured();
}

// Where the code went, so the screen can tell the user honestly.
const delivery = () => (isEmailConfigured() ? "email" : "server-log");

// Creates and sends a fresh code, unless one was requested too recently.
// Returns false when throttled.
async function issueOtp(user, purpose) {
  // The wait applies only while an unused, unexpired code exists (the user
  // can still use that one). Once a code has been used or destroyed there
  // is nothing to fall back on, so a new one is sent straight away.
  const hasActiveCode =
    user.email_verification_otp &&
    user.email_verification_otp_expires &&
    new Date(user.email_verification_otp_expires).getTime() > Date.now();
  if (hasActiveCode && user.last_otp_request) {
    const elapsed = (Date.now() - new Date(user.last_otp_request).getTime()) / 1000;
    if (elapsed < MIN_OTP_REQUEST_INTERVAL_SECONDS) return false;
  }
  const otp = generateOtp();
  await userRepo.setOtp(user.id, otp, new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000));
  await sendOtpEmail(user.email, otp, purpose);
  return true;
}

// Checks a submitted code. Returns null when it is correct, otherwise the
// message to show. Wrong guesses are counted; after MAX_OTP_ATTEMPTS the
// code is destroyed and a new one must be requested.
async function checkOtp(user, otp) {
  const stored = user.email_verification_otp;
  const expires = user.email_verification_otp_expires;
  if (!stored || !expires) return "No code is active for this account. Request a new one.";
  if (new Date(expires).getTime() < Date.now()) {
    await userRepo.clearOtp(user.id);
    return "This code has expired. Request a new one.";
  }
  const given = Buffer.from(String(otp || "").trim());
  const wanted = Buffer.from(stored);
  const matches = given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
  if (!matches) {
    const attempts = await userRepo.recordFailedOtpAttempt(user.id);
    if (attempts >= MAX_OTP_ATTEMPTS) {
      await userRepo.clearOtp(user.id);
      return "Too many wrong codes. Request a new one.";
    }
    const left = MAX_OTP_ATTEMPTS - attempts;
    return `That code is not correct. ${left} ${left === 1 ? "try" : "tries"} left.`;
  }
  return null;
}

router.post("/signup", async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    console.log("📝 Signup attempt:", { email, name, role });

    const validationError = userRepo.validateSignupFields({ name, email, password, role });
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const existingUser = await userRepo.findByEmail(email);
    if (existingUser) {
      console.log("⚠️  User already exists:", email);
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    console.log("💾 Saving user to PostgreSQL...");
    const mustVerify = verificationRequired();
    const user = await userRepo.create({ email, password, name, role, isEmailVerified: !mustVerify });
    notifySafe(user.id, {
      kind: "welcome",
      title: `Welcome to AdaptiveMind, ${String(name).trim().split(" ")[0]}`,
      body:
        role === "teacher"
          ? "Start a live class from the Teacher Console, unlock quizzes and review recommendations for your students."
          : "Join your teacher's live class, then take the lesson quiz. Your quizzes adapt to how you are doing.",
      link: role === "teacher" ? "/teacher" : "/",
      dedupeKey: "welcome",
    });
    console.log("✅ User saved successfully:", user.id);

    if (mustVerify) {
      await issueOtp(user, "signup");
      return res.status(201).json({
        success: true,
        requiresVerification: true,
        email: user.email,
        delivery: delivery(),
        message: "Account created. Enter the code we sent to your e-mail to finish.",
      });
    }

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      user: userRepo.toPublicUser(user),
      token,
    });
  } catch (error) {
    if (error.code === "23505") {
      // unique_violation — a concurrent signup won the race for this email
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists",
      });
    }
    console.error("❌ Signup error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create account",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await userRepo.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = await userRepo.comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // The password is right but the mailbox was never confirmed: send a
    // code instead of a session.
    if (!user.is_email_verified) {
      await issueOtp(user, "login");
      return res.status(403).json({
        success: false,
        requiresVerification: true,
        email: user.email,
        delivery: delivery(),
        message: "Please verify your e-mail first. We sent you a code.",
      });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      message: "Login successful",
      user: userRepo.toPublicUser(user),
      token,
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to login",
    });
  }
});

// Confirms the mailbox of a new account and signs the user in.
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "E-mail and code are required" });
    }
    const user = await userRepo.findByEmail(email);
    if (!user) {
      return res.status(400).json({ success: false, message: "That code is not correct." });
    }
    if (user.is_email_verified) {
      return res.status(400).json({ success: false, message: "This e-mail is already verified. Please sign in." });
    }
    const problem = await checkOtp(user, otp);
    if (problem) return res.status(400).json({ success: false, message: problem });

    const verified = await userRepo.markEmailVerified(user.id);
    res.json({
      success: true,
      message: "E-mail verified",
      user: userRepo.toPublicUser(verified),
      token: generateToken(verified),
    });
  } catch (error) {
    console.error("Verify e-mail error:", error.message);
    res.status(500).json({ success: false, message: "Could not verify the code" });
  }
});

// Sends a new verification code to an unverified account.
router.post("/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "E-mail is required" });
    const user = await userRepo.findByEmail(email);
    if (user && !user.is_email_verified) {
      const sent = await issueOtp(user, "login");
      if (!sent) {
        return res.status(429).json({ success: false, message: "Please wait a minute before asking for another code." });
      }
    }
    // Same answer whether or not the account exists.
    res.json({ success: true, delivery: delivery(), message: "If that account needs verifying, a new code is on its way." });
  } catch (error) {
    console.error("Resend code error:", error.message);
    res.status(500).json({ success: false, message: "Could not send a new code" });
  }
});

// Step 1 of a password reset: send a code to the account's e-mail.
// The answer never reveals whether an account exists for that address.
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid e-mail address" });
    }
    const user = await userRepo.findByEmail(email);
    if (user) await issueOtp(user, "reset");
    res.json({
      success: true,
      delivery: delivery(),
      message: "If an account exists for that e-mail, a reset code has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error.message);
    res.status(500).json({ success: false, message: "Could not start the password reset" });
  }
});

// Step 2: the code plus a new password.
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: "E-mail, code and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }
    const user = await userRepo.findByEmail(email);
    if (!user) {
      return res.status(400).json({ success: false, message: "That code is not correct." });
    }
    const problem = await checkOtp(user, otp);
    if (problem) return res.status(400).json({ success: false, message: problem });

    await userRepo.resetPasswordWithOtp(user.id, newPassword);
    notifySafe(user.id, {
      kind: "security",
      title: "Your password was reset",
      body: "Your password was reset with an e-mailed code. If this wasn't you, reset it again and tell your teacher.",
    });
    res.json({ success: true, message: "Password changed. You can now sign in with the new password." });
  } catch (error) {
    console.error("Reset password error:", error.message);
    res.status(500).json({ success: false, message: "Could not reset the password" });
  }
});

export default router;
