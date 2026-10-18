import { NextResponse } from "next/server";
import { assertCanSeeStudent, assertTeachesSlot, badRequest, forbidden, readJson, withAuth } from "@/lib/authz";
import { db } from "@/db";

const STATUSES = ["present", "absent", "late", "excused"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const GET = withAuth(async (req, user) => {
  const sp = new URL(req.url).searchParams;
  const studentId = sp.get("studentId");
  const slotId = sp.get("slotId");
  const date = sp.get("date");

  if (studentId) {
    await assertCanSeeStudent(user, studentId);
    return NextResponse.json({ records: await db.getAttendanceForStudent(studentId) });
  }
  if (slotId && date) {
    if (user.role === "student" || user.role === "parent") throw forbidden();
    await assertTeachesSlot(user, slotId);
    return NextResponse.json({ records: await db.getAttendanceForSlotAndDate(slotId, date) });
  }
  // No filter: students get their own history, everyone else gets nothing.
  if (user.role === "student") return NextResponse.json({ records: await db.getAttendanceForStudent(user.id) });
  return NextResponse.json({ records: [] });
});

export const POST = withAuth(
  async (req, user) => {
    const body = await readJson(req);
    const records = body.records;
    if (!Array.isArray(records) || records.length === 0) throw badRequest("Records array required");

    // Validate every record and every teacher/slot relationship BEFORE writing anything.
    const classMembers = new Map<string, Set<string>>();
    const clean: Array<{ slotId: string; studentId: string; date: string; status: string; notes?: string }> = [];
    for (const r of records as Record<string, unknown>[]) {
      const slotId = String(r.slotId ?? "");
      const studentId = String(r.studentId ?? "");
      const date = String(r.date ?? "");
      const status = String(r.status ?? "");
      if (!slotId || !studentId || !DATE_RE.test(date) || !STATUSES.includes(status)) {
        throw badRequest("Each record needs slotId, studentId, date (YYYY-MM-DD) and a valid status");
      }
      const { ta } = await assertTeachesSlot(user, slotId);
      if (!classMembers.has(ta.classId)) classMembers.set(ta.classId, new Set(await db.getStudentIdsInClass(ta.classId)));
      if (!classMembers.get(ta.classId)!.has(studentId)) throw badRequest("Student is not in this class");
      clean.push({ slotId, studentId, date, status, notes: typeof r.notes === "string" ? r.notes : undefined });
    }
    await db.markAttendance(clean, user.id);
    return NextResponse.json({ success: true });
  },
  { roles: ["admin", "teacher"] }
);
