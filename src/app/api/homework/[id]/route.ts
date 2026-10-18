import { NextResponse } from "next/server";
import { assertTeachesAssignment, notFound, withAuth } from "@/lib/authz";
import { deleteUpload } from "@/lib/uploads";
import { db } from "@/db";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = withAuth<Ctx>(
  async (_req, user, ctx) => {
    const hw = await db.getHomeworkById((await ctx.params).id);
    if (!hw) throw notFound("Homework not found");
    await assertTeachesAssignment(user, hw.courseId);
    await db.deleteHomework(hw.id);
    await deleteUpload(hw.attachmentFile);
    return NextResponse.json({ success: true });
  },
  { roles: ["teacher", "admin"] }
);
