import { NextResponse } from "next/server";
import { assertTeachesAssignment, badRequest, forbidden, notFound, readJson, withAuth } from "@/lib/authz";
import { db } from "@/db";

type Ctx = { params: Promise<{ id: string }> };

async function loadAssessment(id: string) {
  const assessment = await db.getAssessmentById(id);
  if (!assessment) throw notFound("Assessment not found");
  return assessment;
}

// The class grid: every student of the class with their current mark.
export const GET = withAuth<Ctx>(
  async (_req, user, ctx) => {
    const assessment = await loadAssessment((await ctx.params).id);
    await assertTeachesAssignment(user, assessment.courseId);
    return NextResponse.json({ assessment, grid: await db.getMarkGrid(assessment.id, assessment.classId) });
  },
  { roles: ["teacher", "admin"] }
);

// Save the whole grid in one request. score=null clears a mark.
export const PUT = withAuth<Ctx>(
  async (req, user, ctx) => {
    const assessment = await loadAssessment((await ctx.params).id);
    await assertTeachesAssignment(user, assessment.courseId);
    // Marks in a closed term can only be changed by an admin.
    if (assessment.termClosed && user.role !== "admin") throw forbidden("This term is closed");

    const body = await readJson(req);
    if (!Array.isArray(body.marks) || body.marks.length === 0) throw badRequest("marks array required");
    const members = new Set(await db.getStudentIdsInClass(assessment.classId));
    const entries: Array<{ studentId: string; score: number | null; comment?: string | null }> = [];
    for (const m of body.marks as Record<string, unknown>[]) {
      const studentId = String(m.studentId ?? "");
      if (!members.has(studentId)) throw badRequest("Student is not in this class");
      const score = m.score === null || m.score === "" ? null : Number(m.score);
      if (score !== null && (!Number.isInteger(score) || score < 0 || score > assessment.maxScore)) {
        throw badRequest(`score must be a whole number between 0 and ${assessment.maxScore}`);
      }
      entries.push({ studentId, score, comment: typeof m.comment === "string" && m.comment.trim() ? m.comment.trim() : null });
    }
    const changed = await db.saveMarks(assessment.id, entries, user.id);
    return NextResponse.json({ success: true, changed });
  },
  { roles: ["teacher", "admin"] }
);
