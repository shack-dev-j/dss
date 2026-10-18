import { addDays, isValidDate, schoolDate } from "@/lib/dates";
import { badRequest, forbidden, withAuth } from "@/lib/authz";
import { csvResponse } from "@/lib/csv";
import { attendanceExportRows } from "@/db/admin";
import { db } from "@/db";

// CSV of attendance for one class and date range (default: last 30 days). Class teacher or admin.
export const GET = withAuth(
  async (req, user) => {
    const sp = new URL(req.url).searchParams;
    const classId = sp.get("classId") ?? "";
    if (!classId) throw badRequest("classId is required");
    if (user.role !== "admin" && !(await db.isClassTeacher(user.id, classId))) throw forbidden();
    const to = sp.get("to") ?? schoolDate();
    const from = sp.get("from") ?? addDays(to, -30);
    if (!isValidDate(from) || !isValidDate(to) || from > to) throw badRequest("from/to must be valid dates (YYYY-MM-DD), from <= to");
    const rows = await attendanceExportRows({ classId, from, to });
    const out: (string | number | null)[][] = [["Class", "Student", "Username", "Date", "Subject", "Start", "Status", "Notes", "Recorded by"]];
    for (const r of rows) out.push([r.className, r.studentName, r.username, r.date, r.subjectName, r.startTime, r.status, r.notes, r.recordedBy]);
    return csvResponse(out, `attendance_${classId}_${from}_${to}.csv`);
  },
  { roles: ["teacher", "admin"] }
);
