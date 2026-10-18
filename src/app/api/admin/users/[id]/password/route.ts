import { NextResponse } from "next/server";
import { destroyUserSessions, generateTempPassword, hashPassword } from "@/lib/auth";
import { badRequest, readJson, withAuth } from "@/lib/authz";
import { resetPassword } from "@/db/admin";

type Ctx = { params: Promise<{ id: string }> };

// Admin resets another user's password and signs them out everywhere. The user must pick a new
// password at next login. Leave newPassword empty to get a generated one-time password back.
export const POST = withAuth<Ctx>(
  async (req, user, ctx) => {
    const { id } = await ctx.params;
    const b = await readJson(req);
    const given = typeof b.newPassword === "string" && b.newPassword ? b.newPassword : null;
    if (given && given.length < 8) throw badRequest("New password must be at least 8 characters");
    const password = given ?? generateTempPassword();
    await resetPassword(id, await hashPassword(password, given ? 12 : 10), user.id);
    await destroyUserSessions(id);
    return NextResponse.json({ success: true, ...(given ? {} : { temporaryPassword: password }) });
  },
  { roles: ["admin"] }
);
