import { NextResponse } from "next/server";
import { forbidden, withAuth } from "@/lib/authz";
import { getStudentsInClass } from "@/db/admin";
import { db } from "@/db";

type Ctx = { params: Promise<{ id: string }> };

// Student list of a class: its class teacher or an admin (used to pick whose transcript to open).
export const GET = withAuth<Ctx>(
  async (_req, user, ctx) => {
    const { id } = await ctx.params;
    if (user.role !== "admin" && !(await db.isClassTeacher(user.id, id))) throw forbidden();
    return NextResponse.json({ students: await getStudentsInClass(id) });
  },
  { roles: ["teacher", "admin"] }
);
