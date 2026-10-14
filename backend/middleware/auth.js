import crypto from "crypto";
import { verifyToken } from "../utils/jwt.js";

/**
 * Requires a valid JWT whose userId matches the :id route param - i.e. a
 * user can only manage their own account. There's no admin role in this
 * platform (see models/User.js's role enum), so "self" is the only
 * authorization rule needed here.
 */
export function requireSelf(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }

  if (decoded.userId !== req.params.id) {
    return res.status(403).json({ success: false, message: "You can only manage your own account" });
  }

  req.user = decoded;
  next();
}

/** Any signed-in user. Sets req.user to the token's payload. */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");
  const decoded = scheme === "Bearer" && token ? verifyToken(token) : null;
  if (!decoded) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }
  req.user = decoded;
  next();
}

/** A signed-in user with one of `roles` (e.g. requireRole("teacher")). */
export function requireRole(...roles) {
  return (req, res, next) =>
    requireAuth(req, res, () => {
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ success: false, message: "This page is for teachers only" });
      }
      next();
    });
}

/**
 * Service-to-service calls (adaptive-learning etc.), authenticated with the
 * shared INTERNAL_SERVICE_TOKEN - the same header the Python services'
 * service_auth.py accepts. Compared in constant time.
 */
export function requireInternal(req, res, next) {
  const expected = process.env.INTERNAL_SERVICE_TOKEN || "";
  const given = String(req.headers["x-internal-token"] || "");
  const ok =
    expected.length > 0 &&
    given.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) {
    return res.status(401).json({ success: false, message: "Service authentication required" });
  }
  next();
}
