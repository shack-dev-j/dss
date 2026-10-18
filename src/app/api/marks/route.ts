import { NextResponse } from "next/server";
import { assertCanSeeStudent, badRequest, isClassTeacherOf, withAuth } from "@/lib/authz";
import { db } from "@/db";

// Read-only for now (M2 adds the teacher grid). A student only ever sees their
// own marks; a subject teacher sees only the marks for subjects they teach;
// the class teacher and admins see everything for students they may see.
export const GET = withAuth(async (req, user) => {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId") || (user.role === "student" ? user.id : null);
  if (!studentId) throw badRequest("studentId is required");
  await assertCanSeeStudent(user, studentId);
  let onlyTeacher: string | undefined;
  if (user.role === "teacher") {
    if (!(await isClassTeacherOf(user, studentId))) onlyTeacher = user.id;
  }
  const marks = await db.getMarksForStudent(studentId, onlyTeacher);
  return NextResponse.json({ marks });
});
