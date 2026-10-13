import jwt from "jsonwebtoken";

const JWT_EXPIRATION = 7 * 24 * 60 * 60;

// Read the secret when a token is signed or verified, not when this module
// is imported. index.js imports the routes (and through them this file)
// BEFORE it calls dotenv.config(), so a module-level
// `process.env.JWT_SECRET || "placeholder"` was always evaluated too early
// and every token was signed with the placeholder - a value that is public
// in the source code, and different from the secret the Python services
// (service_auth.py) verify with. There is deliberately no fallback: without
// JWT_SECRET the service must not issue tokens at all.
function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set. Add it to the repository's .env file.");
  }
  return secret;
}

export function generateToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, getSecret(), { expiresIn: JWT_EXPIRATION });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, getSecret());
  } catch {
    return null;
  }
}

export function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const OTP_EXPIRATION_MINUTES = 10;
export const MAX_OTP_ATTEMPTS = 5;
export const MIN_OTP_REQUEST_INTERVAL_SECONDS = 60;
