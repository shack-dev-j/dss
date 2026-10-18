import { NextResponse } from "next/server";
import {
  burnPasswordCheck, clearLoginFailures, comparePassword, createSession, loginThrottled,
  recordLoginFailure, sessionCookie,
} from "@/lib/auth";
import { errorResponse, readJson } from "@/lib/authz";
import { isFeatureEnabled } from "@/lib/env";
import { db } from "@/db";

// The only unauthenticated route (besides demo-login, which 404s unless DEMO_MODE).
export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }
    if (loginThrottled(username)) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }
    const user = await db.getUserByUsername(username);
    const ok = user && user.active ? await comparePassword(password, user.passwordHash) : (await burnPasswordCheck(password), false);
    if (!user || !ok) {
      recordLoginFailure(username);
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }
    clearLoginFailures(username);
    if (user.role === "parent" && !isFeatureEnabled("guardian")) {
      return NextResponse.json({ error: "Parent accounts are not enabled yet" }, { status: 403 });
    }
    const { token, expiresAt } = await createSession(user.id);
    const res = NextResponse.json({ user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role, mustChangePassword: user.mustChangePassword } });
    res.headers.append("Set-Cookie", sessionCookie(token, expiresAt));
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
