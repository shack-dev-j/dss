import { badRequest, forbidden, withAuth } from "@/lib/authz";
import { csvResponse } from "@/lib/csv";
import { gradesExportRows } from "@/db/admin";
import { db } from "@/db";

// CSV of every mark in a class (optionally one term). Admins and the class teacher get all subjects;
// a subject teacher gets only the subjects they teach in that class.
export const GET = withAuth(
  async (req, user) => {
    const sp = new URL(req.url).searchParams;
    const classId = sp.get("classId") ?? "";
    const termId = sp.get("termId") || undefined;
    if (!classId) throw badRequest("classId is required");
    if (termId && !(await db.getTermById(termId))) throw badRequest("Unknown term");
    let teacherId: string | undefined;
    if (user.role === "teacher" && !(await db.isClassTeacher(user.id, classId))) {
      teacherId = user.id;
      if (!(await db.getCourses(user.id)).some((c) => c.classId === classId)) throw forbidden();
    }
    const rows = await gradesExportRows({ classId, termId, teacherId });
    const out: (string | number | null)[][] = [["Class", "Student", "Username", "Term", "Subject", "Teacher", "Assessment", "Type", "Date", "Score", "Max", "Percent", "Comment"]];
    for (const r of rows) {
      out.push([r.className, r.studentName, r.username, r.termName, r.subjectName, r.teacherName, r.assessment, r.type, r.date, r.score, r.maxScore,
        r.score === null ? null : Math.round((r.score / r.maxScore) * 1000) / 10, r.comment]);
    }
    return csvResponse(out, `grades_${rows[0]?.className ?? classId}${termId ? `_${termId}` : ""}.csv`);
  },
  { roles: ["teacher", "admin"] }
);
