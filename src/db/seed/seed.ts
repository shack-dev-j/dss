import { is, sql } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as schema from "../schema";
import type { Db } from "../client";
import { getInitialFictionalData } from "./fictional-data";
import { hashPassword } from "@/lib/auth";

const DEMO_PASSWORD = "Demo123!";
const ADMIN_ROLES = new Set(["director", "manager"]);
const SCHOOL_YEAR = "ay-2026";
const TERM_1 = "term-2026-1";

let cachedHash: { password: string; hash: string } | null = null;
async function demoHash(password: string) {
  // bcrypt is slow on purpose; hash once and reuse for every seeded user.
  if (!cachedHash || cachedHash.password !== password) {
    cachedHash = { password, hash: await hashPassword(password) };
  }
  return cachedHash.hash;
}

/** Demo usernames: the local part of the old demo e-mail, e.g. "azamat.toirov". */
function usernameOf(email: string): string {
  return email.split("@")[0];
}

export async function resetDatabase(db: Db): Promise<void> {
  const names = (Object.values(schema) as unknown[])
    .filter((t): t is PgTable => is(t, PgTable))
    .map((t) => getTableConfig(t).name);
  await db.execute(sql.raw(`TRUNCATE ${names.map((n) => `"${n}"`).join(", ")} RESTART IDENTITY CASCADE`));
}

export async function seedDatabase(db: Db, password: string = DEMO_PASSWORD): Promise<void> {
  const d = getInitialFictionalData();
  const hash = await demoHash(password);
  const date = (s: string | null | undefined) => (s ? new Date(s) : null);

  const seededUsers = d.users.filter((u) => ["director", "manager", "teacher", "student", "parent"].includes(u.role));
  const classOf = (grade?: number, section?: string) =>
    d.classes.find((c) => c.gradeLevel === grade && c.section === section)!;
  const courseTeacher = new Map<string, string>(d.courses.map((c) => [c.id, c.teacherId]));
  const slotCourse = new Map<string, string>(d.timetable.map((s) => [s.id, s.courseId]));

  await db.transaction(async (tx) => {
    await tx.insert(schema.academicYears).values({
      id: SCHOOL_YEAR, name: "2026-2027", startDate: "2026-09-01", endDate: "2027-06-30",
    });
    await tx.insert(schema.terms).values([
      { id: TERM_1, yearId: SCHOOL_YEAR, name: "Term 1", startDate: "2026-09-01", endDate: "2026-12-27", closed: false },
      { id: "term-2026-2", yearId: SCHOOL_YEAR, name: "Term 2", startDate: "2027-01-10", endDate: "2027-03-28", closed: false },
    ]);

    await tx.insert(schema.users).values(
      seededUsers.map((u) => ({
        id: u.id,
        username: usernameOf(u.email),
        fullName: u.fullName,
        role: ADMIN_ROLES.has(u.role) ? "admin" : u.role,
        passwordHash: hash,
      }))
    );

    await tx.insert(schema.classes).values(
      d.classes.map((c) => ({
        id: c.id,
        name: `${c.gradeLevel}-${c.section}`,
        gradeLevel: c.gradeLevel,
        section: c.section,
        yearId: SCHOOL_YEAR,
        classTeacherId: c.id === "cls-10a" ? "usr-tch-01" : null,
      }))
    );
    await tx.insert(schema.students).values(
      seededUsers
        .filter((u) => u.role === "student")
        .map((u) => ({ userId: u.id, classId: classOf(u.gradeLevel, u.section).id }))
    );
    await tx.insert(schema.guardiansStudents).values(
      seededUsers.flatMap((u) => (u.childrenIds || []).map((s) => ({ guardianId: u.id, studentId: s })))
    );

    await tx.insert(schema.subjects).values(
      d.subjects.map(({ id, code, nameUz, nameEn }) => ({ id, code, nameUz, nameEn }))
    );
    await tx.insert(schema.teacherAssignments).values(
      d.courses.map((c) => ({ id: c.id, teacherId: c.teacherId, classId: c.classId, subjectId: c.subjectId }))
    );
    await tx.insert(schema.timetableSlots).values(
      d.timetable.map((s) => ({
        id: s.id, teacherAssignmentId: s.courseId, dayOfWeek: s.dayOfWeek,
        startTime: s.startTime, endTime: s.endTime, room: s.room,
      }))
    );

    await tx.insert(schema.assignments).values(
      d.assignments.map((a) => ({
        id: a.id, teacherAssignmentId: a.courseId, title: a.title, instructions: a.instructions,
        dueDate: new Date(a.dueDate), estimatedMinutes: a.estimatedMinutes, status: a.status,
      }))
    );
    await tx.insert(schema.submissions).values(
      d.submissions.map((s) => ({
        id: s.id, assignmentId: s.assignmentId, studentId: s.studentId, content: s.content,
        submittedAt: new Date(s.submittedAt), grade: s.grade ?? null, maxScore: s.maxScore,
        feedback: s.feedback ?? null, status: s.status,
      }))
    );
    await tx.insert(schema.attendance).values(
      d.attendance.map((a) => ({
        id: a.id, slotId: a.slotId, studentId: a.studentId, date: a.date, status: a.status,
        notes: a.notes ?? null, recordedBy: courseTeacher.get(slotCourse.get(a.slotId)!)!,
      }))
    );

    // Marks: Math (Jasur) and Physics (Bobur) for class 10-A, so the
    // "teacher can't touch another teacher's subject" rules have data to test.
    await tx.insert(schema.assessments).values([
      { id: "asm-math-q1", teacherAssignmentId: "crs-10a-math", termId: TERM_1, type: "quiz", title: "Quiz 1: Trigonometry", date: "2026-09-25", maxScore: 20 },
      { id: "asm-math-mid", teacherAssignmentId: "crs-10a-math", termId: TERM_1, type: "test", title: "Midterm", date: "2026-10-12", maxScore: 100 },
      { id: "asm-phys-q1", teacherAssignmentId: "crs-10a-phys", termId: TERM_1, type: "quiz", title: "Quiz 1: Newton's laws", date: "2026-09-30", maxScore: 10 },
    ]);
    await tx.insert(schema.marks).values([
      { id: "mrk-01", assessmentId: "asm-math-q1", studentId: "usr-stu-01", score: 18, updatedBy: "usr-tch-01" },
      { id: "mrk-02", assessmentId: "asm-math-q1", studentId: "usr-stu-02", score: 15, updatedBy: "usr-tch-01" },
      { id: "mrk-03", assessmentId: "asm-math-mid", studentId: "usr-stu-01", score: 91, updatedBy: "usr-tch-01" },
      { id: "mrk-04", assessmentId: "asm-math-mid", studentId: "usr-stu-02", score: 78, updatedBy: "usr-tch-01" },
      { id: "mrk-05", assessmentId: "asm-phys-q1", studentId: "usr-stu-01", score: 9, updatedBy: "usr-tch-03" },
      { id: "mrk-06", assessmentId: "asm-phys-q1", studentId: "usr-stu-02", score: 7, updatedBy: "usr-tch-03" },
    ]);

    await tx.insert(schema.anonymousSuggestions).values(
      d.anonymousSuggestions.map((s) => ({
        id: s.id, receiptCode: s.receiptCode, secretHash: s.secretHash, category: s.category,
        title: s.title, content: s.content, status: s.status, officialResponse: s.officialResponse ?? null,
        respondedAt: date(s.respondedAt), createdAt: new Date(s.createdAt), updatedAt: new Date(s.updatedAt),
      }))
    );
    await tx.insert(schema.announcements).values(
      d.announcements.map((a) => ({ ...a, createdAt: new Date(a.createdAt) }))
    );
    await tx.insert(schema.policies).values(d.policies);
    await tx.insert(schema.events).values(d.events);
    await tx.insert(schema.clubs).values(d.clubs);
    await tx.insert(schema.studentProjects).values(d.projects);
    await tx.insert(schema.supportTickets).values(
      d.supportTickets.map((t) => ({ ...t, createdAt: new Date(t.createdAt) }))
    );
  });
}
