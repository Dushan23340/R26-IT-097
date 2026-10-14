import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { verifyToken } from "./utils/jwt.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { connectToDatabase } from "./config/database.js";
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import notificationRoutes from "./routes/notifications.js";
import feedbackRoutes from "./routes/feedback.js";
import privacyRoutes from "./routes/privacy.js";
import systemRoutes from "./routes/system.js";
import { ensureSchema } from "./config/schema.js";

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
// Private LAN ranges (RFC1918). In dev, any origin on the local network is
// allowed so a live-class demo works without pinning FRONTEND_URL to an IP
// and port that change between networks/days (and drift when Vite's
// strictPort:false picks the next free port).
const privateLanHttp =
  /^https?:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/i;

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
      if (isDev && (localhostHttp.test(origin) || privateLanHttp.test(origin))) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Internal-Token"],
  }),
);

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
// Per signed-in user, not per IP: a whole class shares one school IP, and
// the inbox (30 s) and status page (15 s) poll in the background, so a
// per-IP budget of 100 would lock every student out within minutes.
const generalLimit = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 600;
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
  message: json429("Too many requests. Please wait a moment and try again."),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => {
    const [scheme, token] = (req.headers.authorization || "").split(" ");
    const user = scheme === "Bearer" && token ? verifyToken(token) : null;
    return user?.userId ? `user:${user.userId}` : `ip:${ipKeyGenerator(req.ip)}`;
  },
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

// Default express.json() body limit is 100kb - too small for the base64
// avatar payload routes/users.js accepts (~500KB decoded -> ~667KB as a
// JSON string), so this raises it platform-wide rather than per-route.
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/privacy", privacyRoutes);
app.use("/api/system", systemRoutes);

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
    await ensureSchema();

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
