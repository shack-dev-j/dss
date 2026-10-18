import { NextResponse } from "next/server";
import { addDays, isValidDate, schoolDate } from "@/lib/dates";
import { badRequest, forbidden, withAuth } from "@/lib/authz";
import { db } from "@/db";

// Whole-class attendance summary: the class teacher of that class, or an admin.
export const GET = withAuth(
  async (req, user) => {
    const sp = new URL(req.url).searchParams;
    const classId = sp.get("classId") ?? "";
    if (!classId) throw badRequest("classId is required");
    if (user.role !== "admin" && !(await db.isClassTeacher(user.id, classId))) throw forbidden();
    const to = sp.get("to") ?? schoolDate();
    const from = sp.get("from") ?? addDays(to, -30);
    if (!isValidDate(from) || !isValidDate(to) || from > to) throw badRequest("from/to must be valid dates (YYYY-MM-DD), from <= to");
    return NextResponse.json({ classId, from, to, students: await db.getClassAttendanceSummary(classId, from, to) });
  },
  { roles: ["teacher", "admin"] }
);
