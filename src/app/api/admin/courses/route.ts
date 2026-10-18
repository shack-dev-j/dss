import { NextResponse } from "next/server";
import { badRequest, readJson, withAuth } from "@/lib/authz";
import { createCourse } from "@/db/admin";
import { db } from "@/db";

// A "course" = which teacher teaches which subject to which class (teacher_assignments).
export const GET = withAuth(async () => NextResponse.json({ courses: await db.getCourses() }), { roles: ["admin"] });

export const POST = withAuth(
  async (req, user) => {
    const b = await readJson(req);
    const { teacherId, classId, subjectId } = b as Record<string, string>;
    if (!teacherId || !classId || !subjectId) throw badRequest("teacherId, classId and subjectId are required");
    return NextResponse.json({ course: await createCourse({ teacherId, classId, subjectId }, user.id) }, { status: 201 });
  },
  { roles: ["admin"] }
);
