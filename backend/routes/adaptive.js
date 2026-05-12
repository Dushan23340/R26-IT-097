import express from "express";
import QuizAttempt from "../models/QuizAttempt.js";

const router = express.Router();

// GET /api/adaptive/attempts — Get current user's quiz attempts
router.get("/attempts", async (req, res) => {
  try {
    const studentId = req.user?.id;
    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const attempts = await QuizAttempt.find({ studentId })
      .sort({ createdAt: -1 })
      .select("-answers"); // Exclude detailed answers for list view

    res.json({
      success: true,
      data: attempts,
    });
  } catch (error) {
    console.error("Error fetching attempts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch attempts",
      error: error.message,
    });
  }
});

// POST /api/adaptive/attempt — Save quiz attempt for authenticated user
router.post("/attempt", async (req, res) => {
  try {
    const studentId = req.user?.id;
    const { unit, quizSet, emotion, attemptId, bloomResults, totalCorrect, totalQuestions, percentageScore } = req.body;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // Create or update quiz attempt
    const attempt = await QuizAttempt.findByIdAndUpdate(
      attemptId,
      {
        studentId,
        unit,
        quizSet,
        emotion,
        bloomResults,
        totalCorrect,
        totalQuestions,
        percentageScore,
      },
      { upsert: true, new: true },
    );

    res.json({
      success: true,
      data: attempt,
    });
  } catch (error) {
    console.error("Error saving attempt:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save attempt",
      error: error.message,
    });
  }
});

export default router;
