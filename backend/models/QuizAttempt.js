import mongoose, { Schema } from "mongoose";

const quizAttemptSchema = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    unit: {
      type: String,
      enum: ["Number Patterns", "Fractions", "Percentages"],
      required: true,
    },
    quizSet: {
      type: String,
      enum: ["Q1", "Q2"],
      required: true,
    },
    emotion: {
      type: String,
      enum: ["Happy", "Normal", "Confused", "Bored", "Frustrated", "Angry"],
      required: true,
    },
    answers: [
      {
        questionId: Schema.Types.ObjectId,
        selectedIndex: Number,
        isCorrect: Boolean,
        bloomLevel: String,
      },
    ],
    bloomResults: {
      Remembering: {
        correct: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        passed: { type: Boolean, default: false },
      },
      Understanding: {
        correct: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        passed: { type: Boolean, default: false },
      },
      Applying: {
        correct: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        passed: { type: Boolean, default: false },
      },
      Analyzing: {
        correct: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        passed: { type: Boolean, default: false },
      },
      Evaluating: {
        correct: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        passed: { type: Boolean, default: false },
      },
      Creating: {
        correct: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        passed: { type: Boolean, default: false },
      },
    },
    totalCorrect: {
      type: Number,
      required: true,
    },
    totalQuestions: {
      type: Number,
      required: true,
    },
    percentageScore: {
      type: Number,
      required: true,
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

quizAttemptSchema.index({ studentId: 1, createdAt: -1 });
quizAttemptSchema.index({ unit: 1, quizSet: 1 });

const QuizAttempt = mongoose.model("QuizAttempt", quizAttemptSchema);

export default QuizAttempt;
