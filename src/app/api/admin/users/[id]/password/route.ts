import { NextResponse } from "next/server";
import { destroyUserSessions, hashPassword } from "@/lib/auth";
import { badRequest, notFound, readJson, withAuth } from "@/lib/authz";
import { db } from "@/db";

type Ctx = { params: Promise<{ id: string }> };

// Admin resets another user's password and signs them out everywhere.
export const POST = withAuth<Ctx>(
  async (req, _user, ctx) => {
    const { id } = await ctx.params;
    const body = await readJson(req);
    const next = typeof body.newPassword === "string" ? body.newPassword : "";
    if (next.length < 8) throw badRequest("New password must be at least 8 characters");
    if (!(await db.getUserById(id))) throw notFound("User not found");
    await db.setPasswordHash(id, await hashPassword(next));
    await destroyUserSessions(id);
    return NextResponse.json({ success: true });
  },
  { roles: ["admin"] }
);
