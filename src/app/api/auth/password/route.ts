import { NextResponse } from "next/server";
import { comparePassword, destroyUserSessions, hashPassword, createSession, sessionCookie } from "@/lib/auth";
import { badRequest, forbidden, readJson, withAuth } from "@/lib/authz";
import { db } from "@/db";

export const POST = withAuth(async (req, user) => {
  const body = await readJson(req);
  const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const next = typeof body.newPassword === "string" ? body.newPassword : "";
  if (next.length < 8) throw badRequest("New password must be at least 8 characters");
  const row = await db.getUserById(user.id);
  if (!row || !(await comparePassword(current, row.passwordHash))) throw forbidden("Current password is incorrect");
  await db.setPasswordHash(user.id, await hashPassword(next));
  // End every session (including this one), then start a fresh one for the caller.
  await destroyUserSessions(user.id);
  const { token, expiresAt } = await createSession(user.id);
  const res = NextResponse.json({ success: true });
  res.headers.append("Set-Cookie", sessionCookie(token, expiresAt));
  return res;
});
