import { NextResponse } from "next/server";
import { assertTeachesAssignment, badRequest, notFound, readJson, withAuth } from "@/lib/authz";
import { db } from "@/db";

export const POST = withAuth(
  async (req, user) => {
    const body = await readJson(req);
    const submissionId = typeof body.submissionId === "string" ? body.submissionId : "";
    const grade = Number(body.grade);
    if (!submissionId || !Number.isFinite(grade)) throw badRequest("Missing submissionId or grade");
    const submission = await db.getSubmissionById(submissionId);
    if (!submission) throw notFound("Submission not found");
    if (grade < 0 || grade > submission.maxScore) throw badRequest(`grade must be between 0 and ${submission.maxScore}`);
    const assignment = await db.getAssignmentById(submission.assignmentId);
    if (!assignment) throw notFound("Assignment not found");
    await assertTeachesAssignment(user, assignment.courseId);
    const updated = await db.gradeSubmission(
      submissionId, Math.round(grade), typeof body.feedback === "string" ? body.feedback : "", user.id
    );
    return NextResponse.json({ submission: updated });
  },
  { roles: ["admin", "teacher"] }
);
