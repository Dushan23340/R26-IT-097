import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { connectToDatabase } from "./config/database.js";
import authRoutes from "./routes/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const defaultOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:8080",
  "http://localhost:8081",
];
const configuredOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((url) => url.trim())
  : defaultOrigins;

const isDev = process.env.NODE_ENV !== "production";
const localhostHttp = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (configuredOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      if (isDev && localhostHttp.test(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const generalLimit = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
const authLimitDefault = process.env.NODE_ENV === "production" ? 40 : 500;
const authLimit = Number(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || authLimitDefault;

const json429 = (msg) => ({
  success: false,
  message: msg,
});

/** Applies to /api/* except /api/auth/* (those use authLimiter only — avoids double-counting). */
const generalLimiter = rateLimit({
  windowMs,
  limit: generalLimit,
  message: json429("Too many requests from this IP, please try again later."),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) =>
    req.method === "OPTIONS" ||
    req.originalUrl.startsWith("/api/auth"),
});

const authLimiter = rateLimit({
  windowMs,
  limit: authLimit,
  message: json429("Too many authentication attempts. Please wait a minute and try again."),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
});

app.use("/api/", generalLimiter);
app.use("/api/auth/", authLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

async function startServer() {
  try {
    await connectToDatabase();

    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`📡 API available at http://localhost:${PORT}/api`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}\n`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

export default app;
