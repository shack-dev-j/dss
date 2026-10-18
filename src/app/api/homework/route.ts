import { NextResponse } from "next/server";
import { assertTeachesAssignment, badRequest, forbidden, withAuth } from "@/lib/authz";
import { isValidDate, schoolDate } from "@/lib/dates";
import { deleteUpload, saveUpload } from "@/lib/uploads";
import { db } from "@/db";

// Students: their class's homework due today or later, soonest first (today's first).
// Teachers: what they posted. Admins: everything. `?all=1` also includes past due dates.
export const GET = withAuth(async (req, user) => {
  const all = new URL(req.url).searchParams.get("all") === "1";
  const fromDate = all ? undefined : schoolDate();
  let homework;
  if (user.role === "student") {
    homework = user.classId ? await db.getHomework({ classId: user.classId, fromDate, studentId: user.id }) : [];
  } else if (user.role === "teacher") {
    homework = await db.getHomework({ teacherId: user.id, fromDate });
  } else if (user.role === "admin") {
    homework = await db.getHomework({ fromDate });
  } else {
    throw forbidden();
  }
  return NextResponse.json({ homework });
});

// multipart/form-data: courseId, description, dueDate (YYYY-MM-DD), optional file.
export const POST = withAuth(
  async (req, user) => {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw badRequest("Expected multipart form data");
    }
    const courseId = String(form.get("courseId") ?? "");
    const description = String(form.get("description") ?? "").trim();
    const dueDate = String(form.get("dueDate") ?? "");
    const file = form.get("file");
    if (!courseId || !description || !isValidDate(dueDate)) throw badRequest("courseId, description and dueDate (YYYY-MM-DD) are required");
    if (description.length > 5000) throw badRequest("description is too long");
    await assertTeachesAssignment(user, courseId);
    if (dueDate < schoolDate()) throw badRequest("dueDate cannot be in the past");

    let upload: Awaited<ReturnType<typeof saveUpload>> | null = null;
    if (file instanceof File && file.size > 0) upload = await saveUpload(file);
    try {
      const homework = await db.createHomework({
        courseId, description, dueDate, postedBy: user.id,
        attachmentFile: upload?.stored, attachmentName: upload?.displayName,
      });
      return NextResponse.json({ homework }, { status: 201 });
    } catch (e) {
      await deleteUpload(upload?.stored); // don't leave an orphaned file if the insert failed
      throw e;
    }
  },
  { roles: ["teacher", "admin"] }
);
