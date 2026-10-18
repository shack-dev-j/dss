import { NextResponse } from "next/server";
import { badRequest, forbidden, notFound, readJson, withAuth } from "@/lib/authz";
import { db } from "@/db";

type Ctx = { params: Promise<{ id: string }> };

// A student marks their own homework as done / not done.
export const POST = withAuth<Ctx>(
  async (req, user, ctx) => {
    const hw = await db.getHomeworkById((await ctx.params).id);
    if (!hw) throw notFound("Homework not found");
    if (hw.classId !== user.classId) throw forbidden();
    const body = await readJson(req);
    if (typeof body.done !== "boolean") throw badRequest("done (boolean) is required");
    await db.setHomeworkDone(hw.id, user.id, body.done);
    return NextResponse.json({ success: true, done: body.done });
  },
  { roles: ["student"] }
);
