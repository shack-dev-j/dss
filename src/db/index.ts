import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./client";
import * as t from "./schema";
import { resetDatabase, seedDatabase } from "./seed/seed";
import { generateReceiptCode, generateSecretToken, hashSecretToken, verifySecretToken } from "@/lib/crypto";
import { SuggestionStatus } from "@/types";

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

// Data access layer over Drizzle. Authorization is NOT decided here: API
// routes call the helpers in src/lib/authz.ts first and pass already-scoped
// filters (classId / teacherId / studentId) into these methods.
class DataRepository {
  // --- Demo ---
  public async resetDemoData(): Promise<void> {
    const db = getDb();
    await resetDatabase(db);
    await seedDatabase(db);
  }

  // --- Users ---
  public async getUserByUsername(username: string) {
    const [u] = await getDb().select().from(t.users).where(eq(t.users.username, username.trim().toLowerCase()));
    return u ?? null;
  }

  public async getUserById(id: string) {
    const [u] = await getDb().select().from(t.users).where(eq(t.users.id, id));
    return u ?? null;
  }

  public async getAllUsers() {
    return getDb().select().from(t.users).orderBy(t.users.role, t.users.fullName);
  }

  public async getFirstUserByRole(role: string) {
    const [u] = await getDb()
      .select()
      .from(t.users)
      .where(and(eq(t.users.role, role), eq(t.users.active, true)))
      .orderBy(t.users.createdAt, t.users.id)
      .limit(1);
    return u ?? null;
  }

  public async setPasswordHash(userId: string, passwordHash: string) {
    await getDb().update(t.users).set({ passwordHash, mustChangePassword: false }).where(eq(t.users.id, userId));
  }

  // --- Timetable ---
  private slotQuery() {
    return getDb()
      .select({
        id: t.timetableSlots.id,
        courseId: t.timetableSlots.teacherAssignmentId,
        dayOfWeek: t.timetableSlots.dayOfWeek,
        startTime: t.timetableSlots.startTime,
        endTime: t.timetableSlots.endTime,
        room: t.timetableSlots.room,
        subjectName: t.subjects.nameUz,
        subjectNameUz: t.subjects.nameUz,
        subjectNameEn: t.subjects.nameEn,
        teacherName: t.users.fullName,
        gradeLevel: t.classes.gradeLevel,
        section: t.classes.section,
        classId: t.classes.id,
        teacherId: t.teacherAssignments.teacherId,
      })
      .from(t.timetableSlots)
      .innerJoin(t.teacherAssignments, eq(t.teacherAssignments.id, t.timetableSlots.teacherAssignmentId))
      .innerJoin(t.subjects, eq(t.subjects.id, t.teacherAssignments.subjectId))
      .innerJoin(t.classes, eq(t.classes.id, t.teacherAssignments.classId))
      .innerJoin(t.users, eq(t.users.id, t.teacherAssignments.teacherId));
  }

  public async getTimetableForClass(classId: string) {
    return this.slotQuery().where(eq(t.classes.id, classId)).orderBy(t.timetableSlots.dayOfWeek, t.timetableSlots.startTime);
  }

  public async getTimetableForStudent(gradeLevel: number, section: string) {
    return this.slotQuery()
      .where(and(eq(t.classes.gradeLevel, gradeLevel), eq(sql`upper(${t.classes.section})`, section.toUpperCase())))
      .orderBy(t.timetableSlots.dayOfWeek, t.timetableSlots.startTime);
  }

  public async getTimetableForTeacherId(teacherId: string) {
    return this.slotQuery()
      .where(eq(t.teacherAssignments.teacherId, teacherId))
      .orderBy(t.timetableSlots.dayOfWeek, t.timetableSlots.startTime);
  }

  public async getAllTimetableSlots() {
    return this.slotQuery().orderBy(t.timetableSlots.dayOfWeek, t.timetableSlots.startTime);
  }

  // --- Assignments & Submissions ---
  private assignmentQuery() {
    return getDb()
      .select({
        id: t.assignments.id,
        courseId: t.assignments.teacherAssignmentId,
        subjectName: t.subjects.nameUz,
        teacherId: t.teacherAssignments.teacherId,
        teacherName: t.users.fullName,
        title: t.assignments.title,
        instructions: t.assignments.instructions,
        dueDate: t.assignments.dueDate,
        estimatedMinutes: t.assignments.estimatedMinutes,
        status: t.assignments.status,
        gradeLevel: t.classes.gradeLevel,
        section: t.classes.section,
        classId: t.classes.id,
      })
      .from(t.assignments)
      .innerJoin(t.teacherAssignments, eq(t.teacherAssignments.id, t.assignments.teacherAssignmentId))
      .innerJoin(t.subjects, eq(t.subjects.id, t.teacherAssignments.subjectId))
      .innerJoin(t.classes, eq(t.classes.id, t.teacherAssignments.classId))
      .innerJoin(t.users, eq(t.users.id, t.teacherAssignments.teacherId));
  }

  private mapAssignment<R extends { dueDate: Date }>(r: R) {
    return { ...r, dueDate: r.dueDate.toISOString() };
  }

  public async getAssignments(filter: { classId?: string; gradeLevel?: number; section?: string; teacherId?: string } = {}) {
    const conds = [];
    if (filter.classId) conds.push(eq(t.classes.id, filter.classId));
    if (filter.gradeLevel && filter.section) {
      conds.push(eq(t.classes.gradeLevel, filter.gradeLevel), eq(sql`upper(${t.classes.section})`, filter.section.toUpperCase()));
    }
    if (filter.teacherId) conds.push(eq(t.teacherAssignments.teacherId, filter.teacherId));
    const rows = await this.assignmentQuery().where(conds.length ? and(...conds) : undefined).orderBy(t.assignments.dueDate);
    return rows.map((r) => this.mapAssignment(r));
  }

  public async getAssignmentById(id: string) {
    const [r] = await this.assignmentQuery().where(eq(t.assignments.id, id));
    return r ? this.mapAssignment(r) : null;
  }

  public async createAssignment(data: {
    courseId: string;
    title: string;
    instructions: string;
    dueDate: string;
    estimatedMinutes: number;
  }) {
    const [row] = await getDb()
      .insert(t.assignments)
      .values({
        teacherAssignmentId: data.courseId,
        title: data.title,
        instructions: data.instructions,
        dueDate: new Date(data.dueDate),
        estimatedMinutes: data.estimatedMinutes,
      })
      .returning({ id: t.assignments.id });
    return (await this.getAssignmentById(row.id))!;
  }

  private submissionQuery() {
    return getDb()
      .select({
        id: t.submissions.id,
        assignmentId: t.submissions.assignmentId,
        studentId: t.submissions.studentId,
        studentName: t.users.fullName,
        content: t.submissions.content,
        submittedAt: t.submissions.submittedAt,
        grade: t.submissions.grade,
        maxScore: t.submissions.maxScore,
        feedback: t.submissions.feedback,
        status: t.submissions.status,
      })
      .from(t.submissions)
      .innerJoin(t.users, eq(t.users.id, t.submissions.studentId));
  }

  private mapSubmission<R extends { submittedAt: Date; grade: number | null; feedback: string | null }>(r: R) {
    return { ...r, submittedAt: r.submittedAt.toISOString(), grade: r.grade ?? undefined, feedback: r.feedback ?? undefined };
  }

  public async getSubmissionsForAssignment(assignmentId: string) {
    const rows = await this.submissionQuery().where(eq(t.submissions.assignmentId, assignmentId));
    return rows.map((r) => this.mapSubmission(r));
  }

  public async getStudentSubmission(assignmentId: string, studentId: string) {
    const [r] = await this.submissionQuery().where(
      and(eq(t.submissions.assignmentId, assignmentId), eq(t.submissions.studentId, studentId))
    );
    return r ? this.mapSubmission(r) : null;
  }

  public async getSubmissionById(id: string) {
    const [r] = await this.submissionQuery().where(eq(t.submissions.id, id));
    return r ? this.mapSubmission(r) : null;
  }

  public async submitAssignment(assignmentId: string, studentId: string, content: string) {
    const [row] = await getDb()
      .insert(t.submissions)
      .values({ assignmentId, studentId, content })
      .onConflictDoUpdate({
        target: [t.submissions.assignmentId, t.submissions.studentId],
        set: { content, submittedAt: new Date(), status: "submitted" },
      })
      .returning({ id: t.submissions.id });
    return (await this.getSubmissionById(row.id))!;
  }

  /** Grades a submission; the audit row is written in the same transaction. */
  public async gradeSubmission(submissionId: string, grade: number, feedback: string, actorId?: string) {
    await getDb().transaction(async (tx) => {
      const [old] = await tx.select().from(t.submissions).where(eq(t.submissions.id, submissionId));
      if (!old) throw new Error("Submission not found");
      await tx.update(t.submissions).set({ grade, feedback, status: "graded" }).where(eq(t.submissions.id, submissionId));
      await tx.insert(t.auditLog).values({
        userId: actorId ?? null,
        action: "submission.grade",
        entity: "submission",
        entityId: submissionId,
        oldValue: { grade: old.grade, feedback: old.feedback },
        newValue: { grade, feedback },
      });
    });
    return (await this.getSubmissionById(submissionId))!;
  }

  // --- Marks (read side; M2 adds the grid and writes) ---
  /** Marks for one student. If teacherId is given, only that teacher's subjects are returned. */
  public async getMarksForStudent(studentId: string, onlyTeacherId?: string) {
    const conds = [eq(t.marks.studentId, studentId)];
    if (onlyTeacherId) conds.push(eq(t.teacherAssignments.teacherId, onlyTeacherId));
    return getDb()
      .select({
        id: t.marks.id,
        assessmentId: t.marks.assessmentId,
        title: t.assessments.title,
        type: t.assessments.type,
        date: t.assessments.date,
        termId: t.assessments.termId,
        termName: t.terms.name,
        subjectId: t.subjects.id,
        subjectName: t.subjects.nameUz,
        score: t.marks.score,
        maxScore: t.assessments.maxScore,
        comment: t.marks.comment,
      })
      .from(t.marks)
      .innerJoin(t.assessments, eq(t.assessments.id, t.marks.assessmentId))
      .innerJoin(t.teacherAssignments, eq(t.teacherAssignments.id, t.assessments.teacherAssignmentId))
      .innerJoin(t.subjects, eq(t.subjects.id, t.teacherAssignments.subjectId))
      .innerJoin(t.terms, eq(t.terms.id, t.assessments.termId))
      .where(and(...conds))
      .orderBy(t.assessments.date);
  }

  // --- Terms, courses, assessments (M2) ---
  public async getTerms() {
    return getDb().select().from(t.terms).orderBy(t.terms.startDate);
  }

  /** Terms of the academic year a course (class + subject) belongs to. */
  public async getTermsForCourse(courseId: string) {
    return getDb()
      .select({ id: t.terms.id, yearId: t.terms.yearId, name: t.terms.name, startDate: t.terms.startDate, endDate: t.terms.endDate, closed: t.terms.closed })
      .from(t.terms)
      .innerJoin(t.classes, eq(t.classes.yearId, t.terms.yearId))
      .innerJoin(t.teacherAssignments, eq(t.teacherAssignments.classId, t.classes.id))
      .where(eq(t.teacherAssignments.id, courseId))
      .orderBy(t.terms.startDate);
  }

  public async getTermById(id: string) {
    const [r] = await getDb().select().from(t.terms).where(eq(t.terms.id, id));
    return r ?? null;
  }

  public async setTermClosed(id: string, closed: boolean, actorId: string) {
    return getDb().transaction(async (tx) => {
      const [old] = await tx.select().from(t.terms).where(eq(t.terms.id, id));
      if (!old) return null;
      const [row] = await tx.update(t.terms).set({ closed }).where(eq(t.terms.id, id)).returning();
      await tx.insert(t.auditLog).values({
        userId: actorId, action: closed ? "term.close" : "term.reopen", entity: "term", entityId: id,
        oldValue: { closed: old.closed }, newValue: { closed },
      });
      return row;
    });
  }

  /** Courses (class + subject) a teacher teaches; pass no teacherId for all (admin). */
  public async getCourses(teacherId?: string) {
    return getDb()
      .select({
        id: t.teacherAssignments.id,
        teacherId: t.teacherAssignments.teacherId,
        teacherName: t.users.fullName,
        classId: t.classes.id,
        className: t.classes.name,
        subjectId: t.subjects.id,
        subjectName: t.subjects.nameUz,
      })
      .from(t.teacherAssignments)
      .innerJoin(t.classes, eq(t.classes.id, t.teacherAssignments.classId))
      .innerJoin(t.subjects, eq(t.subjects.id, t.teacherAssignments.subjectId))
      .innerJoin(t.users, eq(t.users.id, t.teacherAssignments.teacherId))
      .where(teacherId ? eq(t.teacherAssignments.teacherId, teacherId) : undefined)
      .orderBy(t.classes.name, t.subjects.nameUz);
  }

  private assessmentQuery() {
    return getDb()
      .select({
        id: t.assessments.id,
        courseId: t.assessments.teacherAssignmentId,
        classId: t.teacherAssignments.classId,
        termId: t.assessments.termId,
        termClosed: t.terms.closed,
        type: t.assessments.type,
        title: t.assessments.title,
        date: t.assessments.date,
        maxScore: t.assessments.maxScore,
      })
      .from(t.assessments)
      .innerJoin(t.teacherAssignments, eq(t.teacherAssignments.id, t.assessments.teacherAssignmentId))
      .innerJoin(t.terms, eq(t.terms.id, t.assessments.termId));
  }

  public async getAssessmentsForCourse(courseId: string) {
    return this.assessmentQuery().where(eq(t.assessments.teacherAssignmentId, courseId)).orderBy(t.assessments.date);
  }

  public async getAssessmentById(id: string) {
    const [r] = await this.assessmentQuery().where(eq(t.assessments.id, id));
    return r ?? null;
  }

  public async createAssessment(data: {
    courseId: string; termId: string; type: string; title: string; date: string; maxScore: number; actorId: string;
  }) {
    const id = await getDb().transaction(async (tx) => {
      const [row] = await tx
        .insert(t.assessments)
        .values({
          teacherAssignmentId: data.courseId, termId: data.termId, type: data.type,
          title: data.title, date: data.date, maxScore: data.maxScore,
        })
        .returning({ id: t.assessments.id });
      await tx.insert(t.auditLog).values({
        userId: data.actorId, action: "assessment.create", entity: "assessment", entityId: row.id,
        newValue: { title: data.title, type: data.type, maxScore: data.maxScore, termId: data.termId },
      });
      return row.id;
    });
    return (await this.getAssessmentById(id))!;
  }

  /** Every student of the class with their mark (or null) for this assessment. */
  public async getMarkGrid(assessmentId: string, classId: string) {
    return getDb()
      .select({
        studentId: t.students.userId,
        studentName: t.users.fullName,
        score: t.marks.score,
        comment: t.marks.comment,
      })
      .from(t.students)
      .innerJoin(t.users, eq(t.users.id, t.students.userId))
      .leftJoin(t.marks, and(eq(t.marks.studentId, t.students.userId), eq(t.marks.assessmentId, assessmentId)))
      .where(eq(t.students.classId, classId))
      .orderBy(t.users.fullName);
  }

  /**
   * Upserts/deletes marks for one assessment. Each real change writes an
   * audit_log row (old -> new, who) in the same transaction. score=null deletes.
   * Returns how many marks actually changed.
   */
  public async saveMarks(
    assessmentId: string,
    entries: Array<{ studentId: string; score: number | null; comment?: string | null }>,
    actorId: string
  ) {
    let changed = 0;
    await getDb().transaction(async (tx) => {
      for (const e of entries) {
        const [old] = await tx
          .select()
          .from(t.marks)
          .where(and(eq(t.marks.assessmentId, assessmentId), eq(t.marks.studentId, e.studentId)));
        const comment = e.comment ?? null;
        if (e.score === null) {
          if (!old) continue;
          await tx.delete(t.marks).where(eq(t.marks.id, old.id));
          await tx.insert(t.auditLog).values({
            userId: actorId, action: "mark.delete", entity: "mark", entityId: old.id,
            oldValue: { studentId: e.studentId, score: old.score, comment: old.comment }, newValue: null,
          });
          changed++;
        } else if (!old) {
          const [row] = await tx
            .insert(t.marks)
            .values({ assessmentId, studentId: e.studentId, score: e.score, comment, updatedBy: actorId })
            .returning({ id: t.marks.id });
          await tx.insert(t.auditLog).values({
            userId: actorId, action: "mark.create", entity: "mark", entityId: row.id,
            oldValue: null, newValue: { studentId: e.studentId, score: e.score, comment },
          });
          changed++;
        } else if (old.score !== e.score || old.comment !== comment) {
          await tx.update(t.marks).set({ score: e.score, comment, updatedBy: actorId, updatedAt: new Date() }).where(eq(t.marks.id, old.id));
          await tx.insert(t.auditLog).values({
            userId: actorId, action: "mark.update", entity: "mark", entityId: old.id,
            oldValue: { studentId: e.studentId, score: old.score, comment: old.comment },
            newValue: { studentId: e.studentId, score: e.score, comment },
          });
          changed++;
        }
      }
    });
    return changed;
  }

  // --- Attendance ---
  public async getAttendanceForStudent(studentId: string) {
    return this.attendanceQuery().where(eq(t.attendance.studentId, studentId));
  }

  public async getAttendanceForSlotAndDate(slotId: string, date: string) {
    return this.attendanceQuery().where(and(eq(t.attendance.slotId, slotId), eq(t.attendance.date, date)));
  }

  private attendanceQuery() {
    return getDb()
      .select({
        id: t.attendance.id,
        date: t.attendance.date,
        slotId: t.attendance.slotId,
        studentId: t.attendance.studentId,
        studentName: t.users.fullName,
        status: t.attendance.status,
        notes: t.attendance.notes,
      })
      .from(t.attendance)
      .innerJoin(t.users, eq(t.users.id, t.attendance.studentId));
  }

  public async getStudentIdsInClass(classId: string) {
    const rows = await getDb().select({ id: t.students.userId }).from(t.students).where(eq(t.students.classId, classId));
    return rows.map((r) => r.id);
  }

  public async markAttendance(
    records: Array<{ slotId: string; studentId: string; date: string; status: string; notes?: string }>,
    recordedBy: string
  ) {
    await getDb().transaction(async (tx) => {
      for (const r of records) {
        const [old] = await tx
          .select()
          .from(t.attendance)
          .where(and(eq(t.attendance.slotId, r.slotId), eq(t.attendance.studentId, r.studentId), eq(t.attendance.date, r.date)));
        await tx
          .insert(t.attendance)
          .values({ slotId: r.slotId, studentId: r.studentId, date: r.date, status: r.status, notes: r.notes ?? null, recordedBy })
          .onConflictDoUpdate({
            target: [t.attendance.slotId, t.attendance.studentId, t.attendance.date],
            set: { status: r.status, notes: r.notes ?? null, recordedBy },
          });
        if (old && (old.status !== r.status || old.notes !== (r.notes ?? null))) {
          await tx.insert(t.auditLog).values({
            userId: recordedBy,
            action: "attendance.update",
            entity: "attendance",
            entityId: old.id,
            oldValue: { status: old.status, notes: old.notes },
            newValue: { status: r.status, notes: r.notes ?? null },
          });
        }
      }
    });
    return true;
  }

  // --- Attendance register, approvals, summary (M3) ---
  /** Every student of the class with their saved status for this lesson (null = not recorded yet). */
  public async getRegister(slotId: string, date: string, classId: string) {
    return getDb()
      .select({
        studentId: t.students.userId,
        studentName: t.users.fullName,
        status: t.attendance.status,
        notes: t.attendance.notes,
      })
      .from(t.students)
      .innerJoin(t.users, eq(t.users.id, t.students.userId))
      .leftJoin(
        t.attendance,
        and(eq(t.attendance.studentId, t.students.userId), eq(t.attendance.slotId, slotId), eq(t.attendance.date, date))
      )
      .where(eq(t.students.classId, classId))
      .orderBy(t.users.fullName);
  }

  public async hasBackdateApproval(slotId: string, date: string) {
    const [r] = await getDb()
      .select({ id: t.attendanceBackdateApprovals.id })
      .from(t.attendanceBackdateApprovals)
      .where(and(eq(t.attendanceBackdateApprovals.slotId, slotId), eq(t.attendanceBackdateApprovals.date, date)));
    return !!r;
  }

  public async createBackdateApproval(slotId: string, date: string, approvedBy: string, reason?: string) {
    return getDb().transaction(async (tx) => {
      const [row] = await tx
        .insert(t.attendanceBackdateApprovals)
        .values({ slotId, date, approvedBy, reason: reason ?? null })
        .onConflictDoUpdate({
          target: [t.attendanceBackdateApprovals.slotId, t.attendanceBackdateApprovals.date],
          set: { approvedBy, reason: reason ?? null },
        })
        .returning();
      await tx.insert(t.auditLog).values({
        userId: approvedBy, action: "attendance.backdate_approve", entity: "attendance_slot", entityId: slotId,
        newValue: { date, reason: reason ?? null },
      });
      return { ...row, createdAt: row.createdAt.toISOString() };
    });
  }

  public async listBackdateApprovals() {
    const rows = await getDb().select().from(t.attendanceBackdateApprovals).orderBy(desc(t.attendanceBackdateApprovals.createdAt));
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }

  public async getSlotById(slotId: string) {
    const [r] = await this.slotQuery().where(eq(t.timetableSlots.id, slotId));
    return r ?? null;
  }

  /** Classes a user is class teacher of (admin: all classes). */
  public async getClassesForClassTeacher(teacherId?: string) {
    return getDb()
      .select({ id: t.classes.id, name: t.classes.name })
      .from(t.classes)
      .where(teacherId ? eq(t.classes.classTeacherId, teacherId) : undefined)
      .orderBy(t.classes.name);
  }

  public async isClassTeacher(teacherId: string, classId: string) {
    const [r] = await getDb()
      .select({ id: t.classes.id })
      .from(t.classes)
      .where(and(eq(t.classes.id, classId), eq(t.classes.classTeacherId, teacherId)));
    return !!r;
  }

  /**
   * Per-student counts for one class over a date range. Rate = (present + late) /
   * (recorded lessons - excused), i.e. excused absences do not count against the student.
   */
  public async getClassAttendanceSummary(classId: string, from: string, to: string) {
    const rows = await getDb()
      .select({
        studentId: t.students.userId,
        studentName: t.users.fullName,
        status: t.attendance.status,
        n: sql<number>`count(${t.attendance.id})::int`,
      })
      .from(t.students)
      .innerJoin(t.users, eq(t.users.id, t.students.userId))
      .leftJoin(
        t.attendance,
        and(
          eq(t.attendance.studentId, t.students.userId),
          sql`${t.attendance.date} >= ${from}`,
          sql`${t.attendance.date} <= ${to}`,
          sql`${t.attendance.slotId} in (select ${t.timetableSlots.id} from ${t.timetableSlots}
              join ${t.teacherAssignments} on ${t.teacherAssignments.id} = ${t.timetableSlots.teacherAssignmentId}
              where ${t.teacherAssignments.classId} = ${classId})`
        )
      )
      .where(eq(t.students.classId, classId))
      .groupBy(t.students.userId, t.users.fullName, t.attendance.status);
    const byStudent = new Map<string, { studentId: string; studentName: string; present: number; absent: number; late: number; excused: number }>();
    for (const r of rows) {
      const s = byStudent.get(r.studentId) ?? { studentId: r.studentId, studentName: r.studentName, present: 0, absent: 0, late: 0, excused: 0 };
      if (r.status === "present" || r.status === "absent" || r.status === "late" || r.status === "excused") s[r.status] += r.n;
      byStudent.set(r.studentId, s);
    }
    return [...byStudent.values()]
      .map((s) => {
        const counted = s.present + s.absent + s.late;
        return { ...s, rate: counted ? Math.round(((s.present + s.late) / counted) * 1000) / 10 : null };
      })
      .sort((a, b) => a.studentName.localeCompare(b.studentName));
  }

  // --- Homework (M3) ---
  private homeworkQuery(studentId?: string) {
    return getDb()
      .select({
        id: t.homework.id,
        courseId: t.homework.teacherAssignmentId,
        classId: t.teacherAssignments.classId,
        className: t.classes.name,
        subjectName: t.subjects.nameUz,
        teacherId: t.teacherAssignments.teacherId,
        teacherName: t.users.fullName,
        description: t.homework.description,
        dueDate: t.homework.dueDate,
        attachmentName: t.homework.attachmentName,
        attachmentFile: t.homework.attachmentFile,
        postedBy: t.homework.postedBy,
        createdAt: t.homework.createdAt,
        done: studentId
          ? sql<boolean>`exists (select 1 from ${t.homeworkDone} d where d.homework_id = ${t.homework.id} and d.student_id = ${studentId})`
          : sql<boolean>`false`,
      })
      .from(t.homework)
      .innerJoin(t.teacherAssignments, eq(t.teacherAssignments.id, t.homework.teacherAssignmentId))
      .innerJoin(t.classes, eq(t.classes.id, t.teacherAssignments.classId))
      .innerJoin(t.subjects, eq(t.subjects.id, t.teacherAssignments.subjectId))
      .innerJoin(t.users, eq(t.users.id, t.teacherAssignments.teacherId));
  }

  private mapHomework<R extends { createdAt: Date; attachmentFile: string | null }>(r: R) {
    const { attachmentFile, ...rest } = r;
    return { ...rest, createdAt: r.createdAt.toISOString(), hasAttachment: !!attachmentFile };
  }

  public async getHomework(filter: { classId?: string; teacherId?: string; fromDate?: string; studentId?: string }) {
    const conds = [];
    if (filter.classId) conds.push(eq(t.teacherAssignments.classId, filter.classId));
    if (filter.teacherId) conds.push(eq(t.teacherAssignments.teacherId, filter.teacherId));
    if (filter.fromDate) conds.push(sql`${t.homework.dueDate} >= ${filter.fromDate}`);
    const rows = await this.homeworkQuery(filter.studentId)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(t.homework.dueDate, t.homework.createdAt);
    return rows.map((r) => this.mapHomework(r));
  }

  /** Raw row (includes the stored file name) for download/delete. */
  public async getHomeworkById(id: string, studentId?: string) {
    const [r] = await this.homeworkQuery(studentId).where(eq(t.homework.id, id));
    return r ?? null;
  }

  public async createHomework(data: {
    courseId: string; description: string; dueDate: string; postedBy: string;
    attachmentFile?: string | null; attachmentName?: string | null;
  }) {
    const [row] = await getDb()
      .insert(t.homework)
      .values({
        teacherAssignmentId: data.courseId, description: data.description, dueDate: data.dueDate,
        postedBy: data.postedBy, attachmentFile: data.attachmentFile ?? null, attachmentName: data.attachmentName ?? null,
      })
      .returning({ id: t.homework.id });
    return this.mapHomework((await this.getHomeworkById(row.id))!);
  }

  public async deleteHomework(id: string) {
    await getDb().delete(t.homework).where(eq(t.homework.id, id));
  }

  public async setHomeworkDone(homeworkId: string, studentId: string, done: boolean) {
    if (done) {
      await getDb().insert(t.homeworkDone).values({ homeworkId, studentId }).onConflictDoNothing();
    } else {
      await getDb().delete(t.homeworkDone).where(and(eq(t.homeworkDone.homeworkId, homeworkId), eq(t.homeworkDone.studentId, studentId)));
    }
  }

  // --- Truly Anonymous Suggestions (no user id is ever stored) ---
  public async submitAnonymousSuggestion(
    category: "academic" | "facilities" | "catering" | "events" | "general",
    title: string,
    content: string
  ) {
    const receiptCode = generateReceiptCode();
    const secretToken = generateSecretToken();
    const [row] = await getDb()
      .insert(t.anonymousSuggestions)
      .values({ receiptCode, secretHash: hashSecretToken(secretToken), category, title, content })
      .returning({ createdAt: t.anonymousSuggestions.createdAt });
    return { receiptCode, secretToken, createdAt: row.createdAt.toISOString() };
  }

  private publicSuggestion(r: typeof t.anonymousSuggestions.$inferSelect) {
    const { secretHash, ...rest } = r;
    void secretHash;
    return {
      ...rest,
      respondedAt: iso(rest.respondedAt),
      createdAt: rest.createdAt.toISOString(),
      updatedAt: rest.updatedAt.toISOString(),
    };
  }

  public async getAnonymousSuggestionByReceipt(receiptCode: string, secretToken: string) {
    const [record] = await getDb()
      .select()
      .from(t.anonymousSuggestions)
      .where(eq(t.anonymousSuggestions.receiptCode, receiptCode.trim().toUpperCase()));
    if (!record || !verifySecretToken(secretToken.trim(), record.secretHash)) return null;
    return this.publicSuggestion(record);
  }

  /** Caller (route) must already have verified the admin role. */
  public async getAllAnonymousSuggestions() {
    const rows = await getDb().select().from(t.anonymousSuggestions).orderBy(desc(t.anonymousSuggestions.createdAt));
    return rows.map((r) => this.publicSuggestion(r));
  }

  public async updateAnonymousSuggestionStatus(id: string, status: SuggestionStatus, officialResponse?: string) {
    const set: Partial<typeof t.anonymousSuggestions.$inferInsert> = { status, updatedAt: new Date() };
    if (officialResponse !== undefined) {
      set.officialResponse = officialResponse;
      set.respondedAt = new Date();
    }
    const [row] = await getDb().update(t.anonymousSuggestions).set(set).where(eq(t.anonymousSuggestions.id, id)).returning();
    if (!row) throw new Error("Suggestion not found");
    return this.publicSuggestion(row);
  }

  // --- Announcements ---
  public async getAnnouncements(audiences: Array<"all" | "staff" | "class" | "students">) {
    const rows = await getDb()
      .select()
      .from(t.announcements)
      .where(inArray(t.announcements.targetAudience, audiences))
      .orderBy(desc(t.announcements.createdAt));
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }

  public async createAnnouncement(data: {
    authorId: string;
    title: string;
    content: string;
    authorName: string;
    targetAudience: "all" | "staff" | "class" | "students";
    priority: "urgent" | "normal" | "info";
  }) {
    const [r] = await getDb().insert(t.announcements).values(data).returning();
    return { ...r, createdAt: r.createdAt.toISOString() };
  }

  // --- Policies, events, clubs, projects, tickets (feature-flagged modules) ---
  public async getPolicies(category?: string) {
    return getDb().select().from(t.policies).where(category ? eq(t.policies.category, category) : undefined);
  }

  public async getEvents() {
    return getDb().select().from(t.events).orderBy(t.events.date);
  }

  public async registerForEvent(eventId: string) {
    const [row] = await getDb()
      .update(t.events)
      .set({ registeredCount: sql`${t.events.registeredCount} + 1` })
      .where(and(eq(t.events.id, eventId), sql`${t.events.registeredCount} < ${t.events.capacity}`))
      .returning();
    if (row) return row;
    const [exists] = await getDb().select({ id: t.events.id }).from(t.events).where(eq(t.events.id, eventId));
    throw new Error(exists ? "Event capacity full" : "Event not found");
  }

  public async getClubs() {
    return getDb().select().from(t.clubs);
  }

  public async getProjects() {
    const rows = await getDb().select().from(t.studentProjects);
    return rows.map(({ milestones, ...p }) => ({ ...p, milestones }));
  }

  public async getSupportTickets() {
    const rows = await getDb().select().from(t.supportTickets).orderBy(desc(t.supportTickets.createdAt));
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }

  public async createSupportTicket(data: {
    reporterId: string;
    reporterName: string;
    category: "it" | "facilities" | "smartboard";
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
  }) {
    const [r] = await getDb().insert(t.supportTickets).values(data).returning();
    return { ...r, createdAt: r.createdAt.toISOString() };
  }

  public async updateSupportTicketStatus(id: string, status: "open" | "in_progress" | "resolved") {
    const [r] = await getDb().update(t.supportTickets).set({ status }).where(eq(t.supportTickets.id, id)).returning();
    if (!r) throw new Error("Ticket not found");
    return { ...r, createdAt: r.createdAt.toISOString() };
  }
}

export const db = new DataRepository();
