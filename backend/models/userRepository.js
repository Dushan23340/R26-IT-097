import bcrypt from "bcryptjs";
import { query } from "../config/database.js";

const SALT_ROUNDS = 12;
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.created_at,
    avatarDataUrl: row.avatar_data_url || null,
    notificationPreferences: { quizUnlocked: row.notification_quiz_unlocked },
  };
}

export function validateSignupFields({ name, email, password, role }) {
  if (!name || name.trim().length < 2 || name.trim().length > 100) {
    return "Name must be between 2 and 100 characters";
  }
  if (!email || !EMAIL_PATTERN.test(email)) {
    return "Please enter a valid email address";
  }
  if (!password || password.length < 6) {
    return "Password must be at least 6 characters";
  }
  if (!["student", "teacher"].includes(role)) {
    return "Role must be student or teacher";
  }
  return null;
}

export async function findByEmail(email) {
  const { rows } = await query("SELECT * FROM core.users WHERE email = $1", [
    email.toLowerCase().trim(),
  ]);
  return rows[0] || null;
}

export async function findById(id) {
  const { rows } = await query("SELECT * FROM core.users WHERE id = $1", [id]);
  return rows[0] || null;
}

export async function findManyByIdsWithQuizNotificationsOn(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const { rows } = await query(
    "SELECT * FROM core.users WHERE id = ANY($1::text[]) AND notification_quiz_unlocked = true",
    [ids],
  );
  return rows;
}

export async function create({ name, email, password, role }) {
  const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(SALT_ROUNDS));
  const { rows } = await query(
    `INSERT INTO core.users (name, email, password_hash, role, is_email_verified)
     VALUES ($1, $2, $3, $4, true)
     RETURNING *`,
    [name.trim(), email.toLowerCase().trim(), passwordHash, role],
  );
  return rows[0];
}

export async function updateProfile(id, { name, email }) {
  const { rows } = await query(
    `UPDATE core.users
     SET name = COALESCE($2, name), email = COALESCE($3, email), updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, name || null, email ? email.toLowerCase().trim() : null],
  );
  return rows[0] || null;
}

export async function updatePassword(id, newPassword) {
  const passwordHash = await bcrypt.hash(newPassword, await bcrypt.genSalt(SALT_ROUNDS));
  await query("UPDATE core.users SET password_hash = $2, updated_at = now() WHERE id = $1", [
    id,
    passwordHash,
  ]);
}

export async function updateAvatar(id, avatarDataUrl) {
  const { rows } = await query(
    "UPDATE core.users SET avatar_data_url = $2, updated_at = now() WHERE id = $1 RETURNING *",
    [id, avatarDataUrl],
  );
  return rows[0] || null;
}

export async function updateNotificationPrefs(id, { quizUnlocked }) {
  const { rows } = await query(
    "UPDATE core.users SET notification_quiz_unlocked = $2, updated_at = now() WHERE id = $1 RETURNING *",
    [id, quizUnlocked],
  );
  return rows[0] || null;
}

export async function comparePassword(candidatePassword, passwordHash) {
  try {
    return await bcrypt.compare(candidatePassword, passwordHash);
  } catch {
    return false;
  }
}
