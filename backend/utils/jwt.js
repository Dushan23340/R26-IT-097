import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRATION = 7 * 24 * 60 * 60;

export function generateToken(user) {
  const payload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
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
