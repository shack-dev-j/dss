import { NextResponse } from "next/server";
import { destroyUserSessions } from "@/lib/auth";
import { badRequest, readJson, withAuth } from "@/lib/authz";
import { ROLES, Role, updateUser } from "@/db/admin";

type Ctx = { params: Promise<{ id: string }> };

// Edit name, role, class, or deactivate/reactivate. Deactivating ends every session of that user.
export const PATCH = withAuth<Ctx>(
  async (req, user, ctx) => {
    const { id } = await ctx.params;
    const b = await readJson(req);
    const patch: Parameters<typeof updateUser>[1] = {};
    if (b.fullName !== undefined) patch.fullName = String(b.fullName);
    if (b.active !== undefined) {
      if (typeof b.active !== "boolean") throw badRequest("active must be true or false");
      patch.active = b.active;
    }
    if (b.role !== undefined) {
      const role = ROLES.find((r) => r === b.role) as Role | undefined;
      if (!role) throw badRequest("Unknown role");
      patch.role = role;
    }
    if (b.classId !== undefined) patch.classId = typeof b.classId === "string" ? b.classId : null;
    const updated = await updateUser(id, patch, user.id);
    if (patch.active === false) await destroyUserSessions(id);
    return NextResponse.json({ user: { id: updated.id, username: updated.username, fullName: updated.fullName, role: updated.role, active: updated.active } });
  },
  { roles: ["admin"] }
);
