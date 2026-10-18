import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./client";
import * as t from "./schema";
import { HttpError } from "@/lib/errors";
import { DEFAULT_SCALE, GradingScale, parseScale } from "@/lib/grading";
import { isValidDate } from "@/lib/dates";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

const conflict = (msg: string) => new HttpError(409, msg);
const bad = (msg: string) => new HttpError(400, msg);
const missing = (msg: string) => new HttpError(404, msg);

export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,63}$/;
export const ROLES = ["admin", "teacher", "student", "parent"] as const;
export type Role = (typeof ROLES)[number];

async function audit(tx: Tx, userId: string, action: string, entity: string, entityId: string, oldValue: unknown, newValue: unknown) {
  await tx.insert(t.auditLog).values({ userId, action, entity, entityId, oldValue: oldValue ?? null, newValue: newValue ?? null });
}

// ------------------------------------------------------------------ school year / classes
export async function ensureCurrentYear(tx: Tx | ReturnType<typeof getDb> = getDb()) {
  const [y] = await tx.select().from(t.academicYears).orderBy(sql`${t.academicYears.startDate} desc`).limit(1);
  if (y) return y;
  const now = new Date();
  const start = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1; // school year starts in September
  const [row] = await tx
    .insert(t.academicYears)
    .values({ name: `${start}-${start + 1}`, startDate: `${start}-09-01`, endDate: `${start + 1}-06-30` })
    .returning();
  return row;
}

export const className = (grade: number, section: string) => `${grade}-${section.toUpperCase()}`;

export async function getClassesDetailed() {
  return getDb()
    .select({
      id: t.classes.id,
      name: t.classes.name,
      gradeLevel: t.classes.gradeLevel,
      section: t.classes.section,
      classTeacherId: t.classes.classTeacherId,
      classTeacherName: t.users.fullName,
      students: sql<number>`(select count(*)::int from ${t.students} s where s.class_id = ${t.classes.id})`,
    })
    .from(t.classes)
    .leftJoin(t.users, eq(t.users.id, t.classes.classTeacherId))
    .orderBy(asc(t.classes.gradeLevel), asc(t.classes.section));
}

async function assertTeacher(tx: Tx | ReturnType<typeof getDb>, id: string) {
  const [u] = await tx.select({ role: t.users.role, active: t.users.active }).from(t.users).where(eq(t.users.id, id));
  if (!u || u.role !== "teacher" || !u.active) throw bad("Class teacher must be an active teacher");
}

export async function createClass(d: { gradeLevel: number; section: string; classTeacherId?: string | null }, actorId: string) {
  if (!Number.isInteger(d.gradeLevel) || d.gradeLevel < 1 || d.gradeLevel > 12) throw bad("gradeLevel must be 1-12");
  const section = d.section.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,3}$/.test(section)) throw bad("section must be 1-3 letters or digits");
  return getDb().transaction(async (tx) => {
    const year = await ensureCurrentYear(tx);
    const name = className(d.gradeLevel, section);
    const [dup] = await tx.select({ id: t.classes.id }).from(t.classes).where(and(eq(t.classes.name, name), eq(t.classes.yearId, year.id)));
    if (dup) throw conflict(`Class ${name} already exists`);
    if (d.classTeacherId) await assertTeacher(tx, d.classTeacherId);
    const [row] = await tx.insert(t.classes).values({ name, gradeLevel: d.gradeLevel, section, yearId: year.id, classTeacherId: d.classTeacherId ?? null }).returning();
    await audit(tx, actorId, "class.create", "class", row.id, null, { name });
    return row;
  });
}

export async function setClassTeacher(classId: string, teacherId: string | null, actorId: string) {
  return getDb().transaction(async (tx) => {
    const [old] = await tx.select().from(t.classes).where(eq(t.classes.id, classId));
    if (!old) throw missing("Class not found");
    if (teacherId) await assertTeacher(tx, teacherId);
    const [row] = await tx.update(t.classes).set({ classTeacherId: teacherId }).where(eq(t.classes.id, classId)).returning();
    await audit(tx, actorId, "class.set_teacher", "class", classId, { classTeacherId: old.classTeacherId }, { classTeacherId: teacherId });
    return row;
  });
}

// ------------------------------------------------------------------ users
export async function getUsersDetailed() {
  return getDb()
    .select({
      id: t.users.id,
      username: t.users.username,
      fullName: t.users.fullName,
      role: t.users.role,
      active: t.users.active,
      mustChangePassword: t.users.mustChangePassword,
      classId: t.students.classId,
      className: t.classes.name,
      createdAt: t.users.createdAt,
    })
    .from(t.users)
    .leftJoin(t.students, eq(t.students.userId, t.users.id))
    .leftJoin(t.classes, eq(t.classes.id, t.students.classId))
    .orderBy(asc(t.users.role), asc(t.users.fullName));
}

async function assertClassExists(tx: Tx | ReturnType<typeof getDb>, classId: string) {
  const [c] = await tx.select({ id: t.classes.id }).from(t.classes).where(eq(t.classes.id, classId));
  if (!c) throw bad("Class not found");
}

export async function createUser(
  d: { username: string; fullName: string; role: Role; passwordHash: string; classId?: string | null; mustChangePassword: boolean },
  actorId: string
) {
  const username = d.username.trim().toLowerCase();
  if (!USERNAME_RE.test(username)) throw bad("username must be 3-64 characters: a-z, 0-9, dot, dash, underscore");
  if (!d.fullName.trim()) throw bad("fullName is required");
  if (!ROLES.includes(d.role)) throw bad("Unknown role");
  if (d.role === "student" && !d.classId) throw bad("A student needs a class");
  return getDb().transaction(async (tx) => {
    const [dup] = await tx.select({ id: t.users.id }).from(t.users).where(eq(t.users.username, username));
    if (dup) throw conflict(`Username ${username} is already taken`);
    if (d.role === "student") await assertClassExists(tx, d.classId!);
    const [u] = await tx
      .insert(t.users)
      .values({ username, fullName: d.fullName.trim(), role: d.role, passwordHash: d.passwordHash, mustChangePassword: d.mustChangePassword })
      .returning();
    if (d.role === "student") await tx.insert(t.students).values({ userId: u.id, classId: d.classId! });
    await audit(tx, actorId, "user.create", "user", u.id, null, { username, role: d.role, classId: d.classId ?? null });
    return u;
  });
}

export async function updateUser(
  id: string,
  patch: { fullName?: string; active?: boolean; role?: Role; classId?: string | null },
  actorId: string
) {
  return getDb().transaction(async (tx) => {
    const [old] = await tx.select().from(t.users).where(eq(t.users.id, id));
    if (!old) throw missing("User not found");
    const [oldStudent] = await tx.select().from(t.students).where(eq(t.students.userId, id));
    const newRole = patch.role ?? (old.role as Role);
    const newActive = patch.active ?? old.active;
    if (patch.role && !ROLES.includes(patch.role)) throw bad("Unknown role");

    // Never let the school lock itself out of the admin pages.
    if (old.role === "admin" && (newRole !== "admin" || !newActive)) {
      if (id === actorId) throw bad("You cannot demote or deactivate your own account");
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(t.users)
        .where(and(eq(t.users.role, "admin"), eq(t.users.active, true)));
      if (n <= 1) throw bad("This is the last active administrator");
    }
    if (newRole === "student") {
      const classId = patch.classId ?? oldStudent?.classId;
      if (!classId) throw bad("A student needs a class");
      await assertClassExists(tx, classId);
      if (oldStudent) await tx.update(t.students).set({ classId }).where(eq(t.students.userId, id));
      else await tx.insert(t.students).values({ userId: id, classId });
    } else if (oldStudent) {
      await tx.delete(t.students).where(eq(t.students.userId, id));
    }
    // A teacher who still teaches courses can't stop being a teacher: those courses (marks, attendance,
    // timetable) would be left with someone who is no longer allowed to enter data.
    if (old.role === "teacher" && newRole !== "teacher") {
      const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(t.teacherAssignments).where(eq(t.teacherAssignments.teacherId, id));
      if (n > 0) throw conflict(`This teacher still teaches ${n} course(s). Reassign them (School setup → Who teaches what) before changing the role`);
    }
    // A teacher who stops being a teacher can't stay class teacher of anything.
    if (old.role === "teacher" && newRole !== "teacher") {
      await tx.update(t.classes).set({ classTeacherId: null }).where(eq(t.classes.classTeacherId, id));
    }
    const set: Partial<typeof t.users.$inferInsert> = { role: newRole, active: newActive };
    if (patch.fullName !== undefined) {
      if (!patch.fullName.trim()) throw bad("fullName cannot be empty");
      set.fullName = patch.fullName.trim();
    }
    const [row] = await tx.update(t.users).set(set).where(eq(t.users.id, id)).returning();
    await audit(
      tx, actorId, !newActive && old.active ? "user.deactivate" : "user.update", "user", id,
      { fullName: old.fullName, role: old.role, active: old.active, classId: oldStudent?.classId ?? null },
      { fullName: row.fullName, role: row.role, active: row.active, classId: newRole === "student" ? (patch.classId ?? oldStudent?.classId ?? null) : null }
    );
    return row;
  });
}

export async function resetPassword(id: string, passwordHash: string, actorId: string) {
  return getDb().transaction(async (tx) => {
    const [u] = await tx.update(t.users).set({ passwordHash, mustChangePassword: true }).where(eq(t.users.id, id)).returning({ id: t.users.id });
    if (!u) throw missing("User not found");
    await audit(tx, actorId, "user.reset_password", "user", id, null, null);
  });
}

// ------------------------------------------------------------------ subjects, courses, timetable, terms
export async function getSubjects() {
  return getDb().select().from(t.subjects).orderBy(asc(t.subjects.nameUz));
}

export async function createSubject(d: { code: string; nameUz: string; nameEn: string }, actorId: string) {
  const code = d.code.trim().toUpperCase();
  if (!/^[A-Z0-9-]{2,20}$/.test(code) || !d.nameUz.trim() || !d.nameEn.trim()) throw bad("code (2-20 letters/digits/dash), nameUz and nameEn are required");
  return getDb().transaction(async (tx) => {
    const [dup] = await tx.select({ id: t.subjects.id }).from(t.subjects).where(eq(t.subjects.code, code));
    if (dup) throw conflict(`Subject code ${code} already exists`);
    const [row] = await tx.insert(t.subjects).values({ code, nameUz: d.nameUz.trim(), nameEn: d.nameEn.trim() }).returning();
    await audit(tx, actorId, "subject.create", "subject", row.id, null, { code });
    return row;
  });
}

export async function updateSubject(id: string, d: { nameUz?: string; nameEn?: string }, actorId: string) {
  return getDb().transaction(async (tx) => {
    const [old] = await tx.select().from(t.subjects).where(eq(t.subjects.id, id));
    if (!old) throw missing("Subject not found");
    const nameUz = d.nameUz?.trim() || old.nameUz;
    const nameEn = d.nameEn?.trim() || old.nameEn;
    const [row] = await tx.update(t.subjects).set({ nameUz, nameEn }).where(eq(t.subjects.id, id)).returning();
    await audit(tx, actorId, "subject.update", "subject", id, { nameUz: old.nameUz, nameEn: old.nameEn }, { nameUz, nameEn });
    return row;
  });
}

export async function createCourse(d: { teacherId: string; classId: string; subjectId: string }, actorId: string) {
  return getDb().transaction(async (tx) => {
    await assertTeacher(tx, d.teacherId);
    await assertClassExists(tx, d.classId);
    const [subj] = await tx.select({ id: t.subjects.id }).from(t.subjects).where(eq(t.subjects.id, d.subjectId));
    if (!subj) throw bad("Subject not found");
    const [dup] = await tx.select({ id: t.teacherAssignments.id }).from(t.teacherAssignments)
      .where(and(eq(t.teacherAssignments.classId, d.classId), eq(t.teacherAssignments.subjectId, d.subjectId)));
    if (dup) throw conflict("This class already has a teacher for this subject (change the teacher instead)");
    const [row] = await tx.insert(t.teacherAssignments).values(d).returning();
    await audit(tx, actorId, "course.create", "course", row.id, null, d);
    return row;
  });
}

export async function changeCourseTeacher(id: string, teacherId: string, actorId: string) {
  return getDb().transaction(async (tx) => {
    const [old] = await tx.select().from(t.teacherAssignments).where(eq(t.teacherAssignments.id, id));
    if (!old) throw missing("Course not found");
    await assertTeacher(tx, teacherId);
    const [row] = await tx.update(t.teacherAssignments).set({ teacherId }).where(eq(t.teacherAssignments.id, id)).returning();
    await audit(tx, actorId, "course.change_teacher", "course", id, { teacherId: old.teacherId }, { teacherId });
    return row;
  });
}

/** Deleting a course would cascade-delete its marks, homework and attendance, so it is only allowed while empty. */
export async function deleteCourse(id: string, actorId: string) {
  return getDb().transaction(async (tx) => {
    const [old] = await tx.select().from(t.teacherAssignments).where(eq(t.teacherAssignments.id, id));
    if (!old) throw missing("Course not found");
    const [{ n }] = await tx.select({ n: sql<number>`(
        (select count(*) from ${t.assessments} where teacher_assignment_id = ${id}) +
        (select count(*) from ${t.homework} where teacher_assignment_id = ${id}) +
        (select count(*) from ${t.assignments} where teacher_assignment_id = ${id}) +
        (select count(*) from ${t.attendance} a join ${t.timetableSlots} s on s.id = a.slot_id where s.teacher_assignment_id = ${id})
      )::int` }).from(t.teacherAssignments).where(eq(t.teacherAssignments.id, id));
    if (n > 0) throw conflict("This course already has marks, homework or attendance; change its teacher instead of deleting it");
    await tx.delete(t.teacherAssignments).where(eq(t.teacherAssignments.id, id));
    await audit(tx, actorId, "course.delete", "course", id, old, null);
  });
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function createSlot(d: { courseId: string; dayOfWeek: number; startTime: string; endTime: string; room: string }, actorId: string) {
  if (!Number.isInteger(d.dayOfWeek) || d.dayOfWeek < 1 || d.dayOfWeek > 7) throw bad("dayOfWeek must be 1 (Mon) to 7");
  if (!TIME_RE.test(d.startTime) || !TIME_RE.test(d.endTime) || d.startTime >= d.endTime) throw bad("startTime/endTime must be HH:MM and start before end");
  if (!d.room.trim() || d.room.length > 50) throw bad("room is required");
  return getDb().transaction(async (tx) => {
    const [course] = await tx.select().from(t.teacherAssignments).where(eq(t.teacherAssignments.id, d.courseId));
    if (!course) throw bad("Course not found");
    // A teacher or a class cannot be in two lessons at once.
    const overlapping = await tx
      .select({ id: t.timetableSlots.id })
      .from(t.timetableSlots)
      .innerJoin(t.teacherAssignments, eq(t.teacherAssignments.id, t.timetableSlots.teacherAssignmentId))
      .where(and(
        eq(t.timetableSlots.dayOfWeek, d.dayOfWeek),
        sql`${t.timetableSlots.startTime} < ${d.endTime} and ${t.timetableSlots.endTime} > ${d.startTime}`,
        sql`(${t.teacherAssignments.teacherId} = ${course.teacherId} or ${t.teacherAssignments.classId} = ${course.classId})`
      ));
    if (overlapping.length) throw conflict("The teacher or the class already has a lesson at that time");
    const [row] = await tx.insert(t.timetableSlots).values({ teacherAssignmentId: d.courseId, dayOfWeek: d.dayOfWeek, startTime: d.startTime, endTime: d.endTime, room: d.room.trim() }).returning();
    await audit(tx, actorId, "timetable.create", "timetable_slot", row.id, null, d);
    return row;
  });
}

export async function deleteSlot(id: string, actorId: string) {
  return getDb().transaction(async (tx) => {
    const [old] = await tx.select().from(t.timetableSlots).where(eq(t.timetableSlots.id, id));
    if (!old) throw missing("Lesson slot not found");
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(t.attendance).where(eq(t.attendance.slotId, id));
    if (n > 0) throw conflict("Attendance has been recorded for this lesson slot, so it cannot be deleted");
    await tx.delete(t.timetableSlots).where(eq(t.timetableSlots.id, id));
    await audit(tx, actorId, "timetable.delete", "timetable_slot", id, old, null);
  });
}

export async function createTerm(d: { name: string; startDate: string; endDate: string }, actorId: string) {
  if (!d.name.trim() || !isValidDate(d.startDate) || !isValidDate(d.endDate) || d.startDate >= d.endDate) {
    throw bad("name, startDate and endDate (YYYY-MM-DD, start before end) are required");
  }
  return getDb().transaction(async (tx) => {
    const year = await ensureCurrentYear(tx);
    const overlap = await tx.select({ id: t.terms.id }).from(t.terms)
      .where(and(eq(t.terms.yearId, year.id), sql`${t.terms.startDate} <= ${d.endDate} and ${t.terms.endDate} >= ${d.startDate}`));
    if (overlap.length) throw conflict("This term overlaps an existing term");
    const [row] = await tx.insert(t.terms).values({ yearId: year.id, name: d.name.trim(), startDate: d.startDate, endDate: d.endDate }).returning();
    await audit(tx, actorId, "term.create", "term", row.id, null, d);
    return row;
  });
}

// ------------------------------------------------------------------ settings
export async function getGradingScale(): Promise<GradingScale> {
  const [r] = await getDb().select().from(t.settings).where(eq(t.settings.key, "grading_scale"));
  return parseScale(r?.value) ?? DEFAULT_SCALE;
}

export async function setGradingScale(scale: GradingScale, actorId: string) {
  const old = await getGradingScale();
  await getDb().transaction(async (tx) => {
    await tx.insert(t.settings).values({ key: "grading_scale", value: scale, updatedBy: actorId })
      .onConflictDoUpdate({ target: t.settings.key, set: { value: scale, updatedBy: actorId, updatedAt: new Date() } });
    await audit(tx, actorId, "settings.grading_scale", "settings", "grading_scale", old, scale);
  });
}

// ------------------------------------------------------------------ bulk import of class lists
export interface ImportRow { fullName: string; username: string; gradeLevel: number; section: string; password?: string }

/** Validates a whole file; returns one message per problem (empty list = safe to import). */
export async function validateStudentImport(rows: ImportRow[]): Promise<string[]> {
  const errors: string[] = [];
  const seen = new Map<string, number>();
  rows.forEach((r, i) => {
    const line = i + 2; // header is line 1
    if (!r.fullName) errors.push(`Row ${line}: full name is required`);
    if (!USERNAME_RE.test(r.username)) errors.push(`Row ${line}: username "${r.username}" must be 3-64 characters (a-z, 0-9, dot, dash, underscore)`);
    else if (seen.has(r.username)) errors.push(`Row ${line}: username "${r.username}" is repeated (first on row ${seen.get(r.username)})`);
    else seen.set(r.username, line);
    if (!Number.isInteger(r.gradeLevel) || r.gradeLevel < 1 || r.gradeLevel > 12) errors.push(`Row ${line}: grade level must be 1-12`);
    if (!/^[A-Za-z0-9]{1,3}$/.test(r.section)) errors.push(`Row ${line}: section must be 1-3 letters or digits`);
    if (r.password !== undefined && r.password !== "" && r.password.length < 8) errors.push(`Row ${line}: password must be at least 8 characters`);
  });
  const usernames = [...seen.keys()];
  if (usernames.length) {
    const existing = await getDb().select({ u: t.users.username }).from(t.users).where(inArray(t.users.username, usernames));
    for (const e of existing) errors.push(`Row ${seen.get(e.u)}: username "${e.u}" already exists`);
  }
  return errors;
}

/** All-or-nothing: creates missing classes, users and student rows. `hashes` maps username -> password hash. */
export async function importStudents(rows: ImportRow[], hashes: Map<string, string>, actorId: string) {
  return getDb().transaction(async (tx) => {
    const year = await ensureCurrentYear(tx);
    const classIds = new Map<string, string>();
    let createdClasses = 0;
    for (const r of rows) {
      const name = className(r.gradeLevel, r.section);
      if (classIds.has(name)) continue;
      const [c] = await tx.select({ id: t.classes.id }).from(t.classes).where(and(eq(t.classes.name, name), eq(t.classes.yearId, year.id)));
      if (c) classIds.set(name, c.id);
      else {
        const [n] = await tx.insert(t.classes).values({ name, gradeLevel: r.gradeLevel, section: r.section.toUpperCase(), yearId: year.id }).returning({ id: t.classes.id });
        classIds.set(name, n.id);
        createdClasses++;
      }
    }
    for (const r of rows) {
      const [u] = await tx.insert(t.users)
        .values({ username: r.username, fullName: r.fullName, role: "student", passwordHash: hashes.get(r.username)!, mustChangePassword: true })
        .returning({ id: t.users.id });
      await tx.insert(t.students).values({ userId: u.id, classId: classIds.get(className(r.gradeLevel, r.section))! });
    }
    await audit(tx, actorId, "import.students", "import", "students", null, { students: rows.length, createdClasses });
    return { created: rows.length, createdClasses };
  });
}

// ------------------------------------------------------------------ exports
/** Long-form marks: one row per student x assessment. teacherId limits it to that teacher's subjects. */
export async function gradesExportRows(f: { classId: string; termId?: string; teacherId?: string }) {
  const conds = [eq(t.teacherAssignments.classId, f.classId)];
  if (f.termId) conds.push(eq(t.assessments.termId, f.termId));
  if (f.teacherId) conds.push(eq(t.teacherAssignments.teacherId, f.teacherId));
  return getDb()
    .select({
      className: t.classes.name,
      studentName: t.users.fullName,
      username: t.users.username,
      termName: t.terms.name,
      subjectName: t.subjects.nameEn,
      teacherName: sql<string>`(select u.full_name from ${t.users} u where u.id = ${t.teacherAssignments.teacherId})`,
      assessment: t.assessments.title,
      type: t.assessments.type,
      date: t.assessments.date,
      score: t.marks.score,
      maxScore: t.assessments.maxScore,
      comment: t.marks.comment,
    })
    .from(t.assessments)
    .innerJoin(t.teacherAssignments, eq(t.teacherAssignments.id, t.assessments.teacherAssignmentId))
    .innerJoin(t.classes, eq(t.classes.id, t.teacherAssignments.classId))
    .innerJoin(t.subjects, eq(t.subjects.id, t.teacherAssignments.subjectId))
    .innerJoin(t.terms, eq(t.terms.id, t.assessments.termId))
    .innerJoin(t.students, eq(t.students.classId, t.classes.id))
    .innerJoin(t.users, eq(t.users.id, t.students.userId))
    .leftJoin(t.marks, and(eq(t.marks.assessmentId, t.assessments.id), eq(t.marks.studentId, t.students.userId)))
    .where(and(...conds))
    .orderBy(asc(t.users.fullName), asc(t.terms.name), asc(t.subjects.nameEn), asc(t.assessments.date));
}

export async function attendanceExportRows(f: { classId: string; from: string; to: string }) {
  return getDb()
    .select({
      className: t.classes.name,
      studentName: t.users.fullName,
      username: t.users.username,
      date: t.attendance.date,
      subjectName: t.subjects.nameEn,
      startTime: t.timetableSlots.startTime,
      status: t.attendance.status,
      notes: t.attendance.notes,
      recordedBy: sql<string>`(select u.full_name from ${t.users} u where u.id = ${t.attendance.recordedBy})`,
    })
    .from(t.attendance)
    .innerJoin(t.timetableSlots, eq(t.timetableSlots.id, t.attendance.slotId))
    .innerJoin(t.teacherAssignments, eq(t.teacherAssignments.id, t.timetableSlots.teacherAssignmentId))
    .innerJoin(t.classes, eq(t.classes.id, t.teacherAssignments.classId))
    .innerJoin(t.subjects, eq(t.subjects.id, t.teacherAssignments.subjectId))
    .innerJoin(t.users, eq(t.users.id, t.attendance.studentId))
    .where(and(eq(t.classes.id, f.classId), sql`${t.attendance.date} >= ${f.from}`, sql`${t.attendance.date} <= ${f.to}`))
    .orderBy(asc(t.attendance.date), asc(t.timetableSlots.startTime), asc(t.users.fullName));
}


// ------------------------------------------------------------------ transcripts
export async function getTranscriptSource(studentId: string) {
  const [student] = await getDb()
    .select({
      id: t.users.id,
      fullName: t.users.fullName,
      classId: t.classes.id,
      className: t.classes.name,
      yearName: t.academicYears.name,
    })
    .from(t.users)
    .innerJoin(t.students, eq(t.students.userId, t.users.id))
    .innerJoin(t.classes, eq(t.classes.id, t.students.classId))
    .innerJoin(t.academicYears, eq(t.academicYears.id, t.classes.yearId))
    .where(and(eq(t.users.id, studentId), eq(t.users.role, "student")));
  if (!student) return null;
  const marks = await getDb()
    .select({
      subjectId: t.subjects.id,
      subjectName: t.subjects.nameUz,
      teacherName: sql<string>`(select u.full_name from ${t.users} u where u.id = ${t.teacherAssignments.teacherId})`,
      termId: t.terms.id,
      termName: t.terms.name,
      termStart: t.terms.startDate,
      score: t.marks.score,
      maxScore: t.assessments.maxScore,
    })
    .from(t.marks)
    .innerJoin(t.assessments, eq(t.assessments.id, t.marks.assessmentId))
    .innerJoin(t.teacherAssignments, eq(t.teacherAssignments.id, t.assessments.teacherAssignmentId))
    .innerJoin(t.subjects, eq(t.subjects.id, t.teacherAssignments.subjectId))
    .innerJoin(t.terms, eq(t.terms.id, t.assessments.termId))
    .where(eq(t.marks.studentId, studentId));
  return { student, marks };
}

export async function getStudentsInClass(classId: string) {
  return getDb()
    .select({ id: t.users.id, fullName: t.users.fullName })
    .from(t.students)
    .innerJoin(t.users, eq(t.users.id, t.students.userId))
    .where(and(eq(t.students.classId, classId), eq(t.users.active, true)))
    .orderBy(asc(t.users.fullName));
}
