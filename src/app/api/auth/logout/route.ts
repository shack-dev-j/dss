import { NextResponse } from "next/server";
import { clearedSessionCookie, destroySession, readSessionToken } from "@/lib/auth";
import { withAuth } from "@/lib/authz";

export const POST = withAuth(async (req) => {
  const token = readSessionToken(req);
  if (token) await destroySession(token);
  const res = NextResponse.json({ success: true });
  res.headers.append("Set-Cookie", clearedSessionCookie());
  return res;
});
