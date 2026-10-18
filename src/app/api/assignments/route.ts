import { NextResponse } from "next/server";
import { assertTeachesAssignment, badRequest, readJson, withAuth } from "@/lib/authz";
import { db } from "@/db";

// Students only ever see their own class; teachers only their own assignments.
// Query params are honoured for admins only.
export const GET = withAuth(async (req, user) => {
  const sp = new URL(req.url).searchParams;
  let assignments: Awaited<ReturnType<typeof db.getAssignments>>;
  if (user.role === "student") {
    assignments = user.classId ? await db.getAssignments({ classId: user.classId }) : [];
  } else if (user.role === "teacher") {
    assignments = await db.getAssignments({ teacherId: user.id });
  } else if (user.role === "admin") {
    const grade = sp.get("gradeLevel");
    assignments = await db.getAssignments({
      gradeLevel: grade ? parseInt(grade) : undefined,
      section: sp.get("section") || undefined,
      teacherId: sp.get("teacherId") || undefined,
    });
  } else {
    assignments = [];
  }
  return NextResponse.json({ assignments });
});

export const POST = withAuth(
  async (req, user) => {
    const body = await readJson(req);
    const { courseId, title, instructions, dueDate } = body as Record<string, string>;
    if (!courseId || !title || !instructions || !dueDate || isNaN(Date.parse(dueDate))) {
      throw badRequest("courseId, title, instructions and a valid dueDate are required");
    }
    await assertTeachesAssignment(user, courseId);
    const assignment = await db.createAssignment({
      courseId, title, instructions, dueDate,
      estimatedMinutes: Number(body.estimatedMinutes) > 0 ? Number(body.estimatedMinutes) : 45,
    });
    return NextResponse.json({ assignment }, { status: 201 });
  },
  { roles: ["admin", "teacher"] }
);
