import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "node:crypto";
import { database } from "./db.mjs";

const encoder = new TextEncoder();
const secret = () => {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error("JWT_SECRET must be at least 32 characters.");
  return encoder.encode(value);
};

export function publicUser(user) {
  return { id: user.id, username: user.username, role: user.role, status: user.status, activationExpiresAt: user.activation_expires_at ?? null, createdAt: user.created_at, lastLoginAt: user.last_login_at ?? null };
}

export async function createSession(user) {
  return new SignJWT({ role: user.role, username: user.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
}

export async function sessionFromToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const [rows] = await database().execute("SELECT * FROM users WHERE id = ? LIMIT 1", [payload.sub]);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function seedInitialAdmin() {
  const db = database();
  const [existing] = await db.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (existing.length) return;
  const username = process.env.INITIAL_ADMIN_USERNAME;
  const passwordHash = await initialPasswordHash("INITIAL_ADMIN_PASSWORD_HASH", "INITIAL_ADMIN_PASSWORD");
  if (!username || !passwordHash) throw new Error("INITIAL_ADMIN_USERNAME and INITIAL_ADMIN_PASSWORD_HASH are required for the first database migration.");
  await db.execute("INSERT INTO users (id, username, password_hash, role, status) VALUES (?, ?, ?, 'admin', 'active')", [randomUUID(), username.toLowerCase(), passwordHash]);
}

export async function seedInitialDemoUser() {
  const username = process.env.INITIAL_DEMO_USERNAME?.toLowerCase();
  const passwordHash = await initialPasswordHash("INITIAL_DEMO_PASSWORD_HASH", "INITIAL_DEMO_PASSWORD");
  if (!username && !passwordHash) return;
  if (!username || !passwordHash) throw new Error("INITIAL_DEMO_USERNAME and INITIAL_DEMO_PASSWORD_HASH must be provided together.");
  const db = database();
  const [existing] = await db.execute("SELECT id FROM users WHERE username = ? LIMIT 1", [username]);
  if (!existing.length) await db.execute("INSERT INTO users (id, username, password_hash, role, status) VALUES (?, ?, ?, 'user', 'active')", [randomUUID(), username, passwordHash]);
}

export async function initialPasswordHash(hashKey, passwordKey) {
  const suppliedHash = process.env[hashKey];
  if (suppliedHash) {
    if (!/^\$2[aby]\$\d{2}\$/.test(suppliedHash)) throw new Error(`${hashKey} must be a valid bcrypt hash.`);
    return suppliedHash;
  }
  const password = process.env[passwordKey];
  if (!password) return null;
  if (password.length < 12) throw new Error(`${passwordKey} must be at least 12 characters.`);
  return bcrypt.hash(password, 12);
}

export function activeUserOrError(user) {
  if (!user) return "يجب تسجيل الدخول أولاً.";
  if (user.status !== "active") return "الحساب غير مفعل أو موقوف.";
  if (user.activation_expires_at && new Date(user.activation_expires_at).getTime() < Date.now()) return "انتهت فترة تفعيل الحساب.";
  return null;
}
