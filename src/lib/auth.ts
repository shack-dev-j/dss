import crypto from "crypto";
import bcrypt from "bcryptjs";
import { eq, lt } from "drizzle-orm";
import { getDb } from "@/db/client";
import { sessions, users, students, classes } from "@/db/schema";
import { env } from "@/lib/env";
import type { UserRole, UserSession } from "@/types";

export const SESSION_COOKIE = "namps_session";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours, sliding

/** Cost 12 for passwords people choose; imports use 10 for generated, one-time passwords (they must change them at first login). */
export async function hashPassword(password: string, cost = 12): Promise<string> {
  return bcrypt.hash(password, cost);
}

const TEMP_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function generateTempPassword(length = 12): string {
  let out = "";
  for (let i = 0; i < length; i++) out += TEMP_ALPHABET[crypto.randomInt(TEMP_ALPHABET.length)];
  return out;
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Used to keep login timing the same for unknown usernames.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);
export async function burnPasswordCheck(password: string): Promise<void> {
  await bcrypt.compare(password, DUMMY_HASH);
}

function hashToken(token: string): string {
  return crypto.createHmac("sha256", env.sessionSecret()).update(token).digest("hex");
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const db = getDb();
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  // opportunistic cleanup of expired rows
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  return { token, expiresAt };
}

export async function destroySession(token: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.id, hashToken(token)));
}

export async function destroyUserSessions(userId: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.userId, userId));
}

export function readSessionToken(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0 && part.slice(0, idx).trim() === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(idx + 1).trim()) || null;
    }
  }
  return null;
}

/** Resolve the logged-in user from the request cookie, or null. Slides the expiry. */
export async function getSessionUser(req: Request): Promise<UserSession | null> {
  const token = readSessionToken(req);
  if (!token) return null;
  const db = getDb();
  const id = hashToken(token);
  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      user: users,
      classId: students.classId,
      gradeLevel: classes.gradeLevel,
      section: classes.section,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(students, eq(students.userId, users.id))
    .leftJoin(classes, eq(classes.id, students.classId))
    .where(eq(sessions.id, id));
  if (!row || !row.user.active) return null;
  const now = Date.now();
  if (row.expiresAt.getTime() <= now) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  if (row.expiresAt.getTime() - now < SESSION_TTL_MS - 5 * 60 * 1000) {
    await db.update(sessions).set({ expiresAt: new Date(now + SESSION_TTL_MS) }).where(eq(sessions.id, id));
  }
  return {
    id: row.user.id,
    username: row.user.username,
    fullName: row.user.fullName,
    role: row.user.role as UserRole,
    classId: row.classId ?? undefined,
    gradeLevel: row.gradeLevel ?? undefined,
    section: row.section ?? undefined,
    mustChangePassword: row.user.mustChangePassword,
  };
}

export function sessionCookie(token: string, expiresAt: Date): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${secure}`;
}

export function clearedSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

// Tiny in-memory login throttle (per process): 10 failures / 15 min per key.
const failures = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60 * 1000;
export function loginThrottled(key: string): boolean {
  const f = failures.get(key);
  if (!f) return false;
  if (Date.now() - f.first > WINDOW_MS) {
    failures.delete(key);
    return false;
  }
  return f.count >= 10;
}
export function recordLoginFailure(key: string): void {
  const f = failures.get(key);
  if (!f || Date.now() - f.first > WINDOW_MS) failures.set(key, { count: 1, first: Date.now() });
  else f.count += 1;
}
export function clearLoginFailures(key: string): void {
  failures.delete(key);
}
