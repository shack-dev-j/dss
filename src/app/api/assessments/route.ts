import { NextResponse } from "next/server";
import { assertTeachesAssignment, badRequest, forbidden, notFound, readJson, withAuth } from "@/lib/authz";
import { db } from "@/db";

const TYPES = ["quiz", "test", "homework_check", "exam"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const GET = withAuth(
  async (req, user) => {
    const courseId = new URL(req.url).searchParams.get("courseId");
    if (!courseId) throw badRequest("courseId is required");
    await assertTeachesAssignment(user, courseId);
    return NextResponse.json({ assessments: await db.getAssessmentsForCourse(courseId) });
  },
  { roles: ["teacher", "admin"] }
);

export const POST = withAuth(
  async (req, user) => {
    const b = await readJson(req);
    const courseId = String(b.courseId ?? "");
    const termId = String(b.termId ?? "");
    const type = String(b.type ?? "");
    const title = typeof b.title === "string" ? b.title.trim() : "";
    const date = String(b.date ?? "");
    const maxScore = Number(b.maxScore);
    await assertTeachesAssignment(user, courseId);
    const term = await db.getTermById(termId);
    if (!term) throw notFound("Term not found");
    // The term must belong to the same academic year as the course's class.
    if (!(await db.getTermsForCourse(courseId)).some((t) => t.id === termId)) throw badRequest("This term belongs to a different academic year than the class");
    if (term.closed && user.role !== "admin") throw forbidden("This term is closed");
    if (!title || !TYPES.includes(type) || !DATE_RE.test(date) || !Number.isInteger(maxScore) || maxScore < 1 || maxScore > 1000) {
      throw badRequest("title, type, date (YYYY-MM-DD) and an integer maxScore (1-1000) are required");
    }
    const assessment = await db.createAssessment({ courseId, termId, type, title, date, maxScore, actorId: user.id });
    return NextResponse.json({ assessment }, { status: 201 });
  },
  { roles: ["teacher", "admin"] }
);
