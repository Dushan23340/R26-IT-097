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
