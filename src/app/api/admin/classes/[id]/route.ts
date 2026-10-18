import { NextResponse } from "next/server";
import { badRequest, readJson, withAuth } from "@/lib/authz";
import { setClassTeacher } from "@/db/admin";

type Ctx = { params: Promise<{ id: string }> };

// Appoint (or clear, with null) the class teacher.
export const PATCH = withAuth<Ctx>(
  async (req, user, ctx) => {
    const b = await readJson(req);
    if (b.classTeacherId !== null && typeof b.classTeacherId !== "string") throw badRequest("classTeacherId must be a user id or null");
    return NextResponse.json({ class: await setClassTeacher((await ctx.params).id, b.classTeacherId as string | null, user.id) });
  },
  { roles: ["admin"] }
);
