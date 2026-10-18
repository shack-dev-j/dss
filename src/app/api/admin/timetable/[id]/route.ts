import { NextResponse } from "next/server";
import { withAuth } from "@/lib/authz";
import { deleteSlot } from "@/db/admin";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = withAuth<Ctx>(
  async (_req, user, ctx) => {
    await deleteSlot((await ctx.params).id, user.id);
    return NextResponse.json({ success: true });
  },
  { roles: ["admin"] }
);
