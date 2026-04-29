import jwt, { SignOptions } from 'jsonwebtoken';
import { IUser } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRATION = 7 * 24 * 60 * 60; // 7 days in seconds

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Generate JWT token for a user
 */
export function generateToken(user: IUser): string {
  const payload: JwtPayload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  };

  const options: SignOptions = {
    expiresIn: JWT_EXPIRATION,
  };

  return jwt.sign(payload, JWT_SECRET, options);
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Generate OTP (6 digits)
 */
export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * OTP expiration time (10 minutes)
 */
export const OTP_EXPIRATION_MINUTES = 10;

/**
 * Maximum OTP attempts
 */
export const MAX_OTP_ATTEMPTS = 5;

/**
 * Minimum time between OTP requests (60 seconds)
 */
export const MIN_OTP_REQUEST_INTERVAL_SECONDS = 60;
