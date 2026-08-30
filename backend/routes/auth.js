import express from "express";
import * as userRepo from "../models/userRepository.js";
import { generateToken } from "../utils/jwt.js";

const router = express.Router();

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
    const user = await userRepo.create({ email, password, name, role });
    console.log("✅ User saved successfully:", user.id);

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

export default router;
