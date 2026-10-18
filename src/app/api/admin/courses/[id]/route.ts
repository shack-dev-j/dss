import { NextResponse } from "next/server";
import { badRequest, readJson, withAuth } from "@/lib/authz";
import { changeCourseTeacher, deleteCourse } from "@/db/admin";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withAuth<Ctx>(
  async (req, user, ctx) => {
    const b = await readJson(req);
    if (typeof b.teacherId !== "string") throw badRequest("teacherId is required");
    return NextResponse.json({ course: await changeCourseTeacher((await ctx.params).id, b.teacherId, user.id) });
  },
  { roles: ["admin"] }
);

export const DELETE = withAuth<Ctx>(
  async (_req, user, ctx) => {
    await deleteCourse((await ctx.params).id, user.id);
    return NextResponse.json({ success: true });
  },
  { roles: ["admin"] }
);
