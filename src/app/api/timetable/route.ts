import { NextResponse } from "next/server";
import { withAuth } from "@/lib/authz";
import { db } from "@/db";

// Scope comes from the session, never from query params (admins may filter).
export const GET = withAuth(async (req, user) => {
  const sp = new URL(req.url).searchParams;
  if (user.role === "student") {
    return NextResponse.json({ slots: user.classId ? await db.getTimetableForClass(user.classId) : [] });
  }
  if (user.role === "teacher") {
    return NextResponse.json({ slots: await db.getTimetableForTeacherId(user.id) });
  }
  if (user.role === "admin") {
    const grade = sp.get("gradeLevel");
    const section = sp.get("section");
    const teacherId = sp.get("teacherId");
    if (grade && section) return NextResponse.json({ slots: await db.getTimetableForStudent(parseInt(grade), section) });
    if (teacherId) return NextResponse.json({ slots: await db.getTimetableForTeacherId(teacherId) });
    return NextResponse.json({ slots: await db.getAllTimetableSlots() });
  }
  return NextResponse.json({ slots: [] });
});
