import { NextResponse } from "next/server";
import { createSession, sessionCookie } from "@/lib/auth";
import { errorResponse, readJson } from "@/lib/authz";
import { isDemoMode, isFeatureEnabled } from "@/lib/env";
import { db } from "@/db";

// Role switcher backend: starts a real server session as the seeded demo user
// of the requested role. Only exists when DEMO_MODE=true.
export async function POST(req: Request) {
  try {
    if (!isDemoMode()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await readJson(req);
    const role = body.role;
    if (role !== "student" && role !== "teacher" && role !== "admin" && role !== "parent") {
      return NextResponse.json({ error: "Unknown role" }, { status: 400 });
    }
    if (role === "parent" && !isFeatureEnabled("guardian")) {
      return NextResponse.json({ error: "Parent accounts are not enabled yet" }, { status: 403 });
    }
    const user = await db.getFirstUserByRole(role);
    if (!user) return NextResponse.json({ error: "No demo user for role" }, { status: 404 });
    const { token, expiresAt } = await createSession(user.id);
    const res = NextResponse.json({ user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role } });
    res.headers.append("Set-Cookie", sessionCookie(token, expiresAt));
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
