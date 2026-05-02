import express from "express";
import User from "../models/User.js";
import { generateToken } from "../utils/jwt.js";

const router = express.Router();

router.post("/signup", async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    console.log("📝 Signup attempt:", { email, name, role });

    if (!email || !password || !name || !role) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log("⚠️  User already exists:", email);
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const user = new User({
      email,
      password,
      name,
      role,
      isEmailVerified: true,
    });

    console.log("💾 Saving user to MongoDB...");
    await user.save();
    console.log("✅ User saved successfully:", user._id);

    const token = generateToken(user);

    const userData = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    };

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      user: userData,
      token,
    });
  } catch (error) {
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

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = generateToken(user);

    const userData = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    };

    res.json({
      success: true,
      message: "Login successful",
      user: userData,
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
