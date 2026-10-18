import { NextResponse } from "next/server";
import { badRequest, notFound, readJson, withAuth } from "@/lib/authz";
import { db } from "@/db";

type Ctx = { params: Promise<{ id: string }> };

// Closing a term freezes marks for teachers; only admins may close/reopen it.
export const PATCH = withAuth<Ctx>(
  async (req, user, ctx) => {
    const { id } = await ctx.params;
    const body = await readJson(req);
    if (typeof body.closed !== "boolean") throw badRequest("closed (boolean) is required");
    const term = await db.setTermClosed(id, body.closed, user.id);
    if (!term) throw notFound("Term not found");
    return NextResponse.json({ term });
  },
  { roles: ["admin"] }
);
