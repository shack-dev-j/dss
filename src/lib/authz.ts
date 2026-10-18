import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { classes, guardiansStudents, students, teacherAssignments, timetableSlots } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { ConfigError, FeatureName, isDemoMode, isFeatureEnabled } from "@/lib/env";
import type { UserRole, UserSession } from "@/types";

import { HttpError } from "@/lib/errors";
export { HttpError };

export const forbidden = (msg = "Forbidden") => new HttpError(403, msg);
export const notFound = (msg = "Not found") => new HttpError(404, msg);
export const badRequest = (msg = "Bad request") => new HttpError(400, msg);

interface Options {
  /** Allowed roles. Omit for "any logged-in user". */
  roles?: UserRole[];
  /** Route only exists when one of these features is enabled (else 404). */
  feature?: FeatureName | FeatureName[];
  /** Route only exists when DEMO_MODE=true (else 404). */
  demoOnly?: boolean;
  /** Usable while the user still has to choose a new password (login, logout, change password). */
  allowPasswordChangePending?: boolean;
}

type Handler<C> = (req: Request, user: UserSession, ctx: C) => Promise<Response>;

/**
 * Wraps every API handler. Check order is fixed: 401 (no session) ->
 * 404 (feature off / not demo mode) -> 403 (wrong role). Ownership checks
 * (403/404) happen inside handlers via the helpers below.
 */
export function withAuth<C = unknown>(handler: Handler<C>, opts: Options = {}) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      const user = await getSessionUser(req);
      if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      if (user.mustChangePassword && !opts.allowPasswordChangePending) {
        return NextResponse.json({ error: "Password change required", code: "PASSWORD_CHANGE_REQUIRED" }, { status: 403 });
      }
      if (opts.demoOnly && !isDemoMode()) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (opts.feature) {
        const list = Array.isArray(opts.feature) ? opts.feature : [opts.feature];
        if (!list.some(isFeatureEnabled)) return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (opts.roles && !opts.roles.includes(user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return await handler(req, user, ctx);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ConfigError) {
    console.error("Configuration error:", e.message);
    return NextResponse.json({ error: "Server is not configured" }, { status: 500 });
  }
  console.error("Unhandled API error:", e);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object") return body as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  throw badRequest("Invalid JSON body");
}

// ---------------------------------------------------------------------------
// Ownership helpers
// ---------------------------------------------------------------------------

/** Does this teacher teach the given class (any subject) or act as its class teacher? */
async function teachesClass(teacherId: string, classId: string): Promise<boolean> {
  const db = getDb();
  const [ta] = await db
    .select({ id: teacherAssignments.id })
    .from(teacherAssignments)
    .where(and(eq(teacherAssignments.teacherId, teacherId), eq(teacherAssignments.classId, classId)))
    .limit(1);
  if (ta) return true;
  const [cls] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.classTeacherId, teacherId)));
  return !!cls;
}

export async function isClassTeacherOf(user: UserSession, studentId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: classes.id })
    .from(students)
    .innerJoin(classes, eq(classes.id, students.classId))
    .where(and(eq(students.userId, studentId), eq(classes.classTeacherId, user.id)));
  return !!row;
}

/** Student data (marks, attendance, ...) is visible to: admin, the student, their teachers, their guardians. */
export async function canSeeStudent(user: UserSession, studentId: string): Promise<boolean> {
  if (user.role === "admin") return true;
  if (user.role === "student") return user.id === studentId;
  const db = getDb();
  if (user.role === "teacher") {
    const [s] = await db.select({ classId: students.classId }).from(students).where(eq(students.userId, studentId));
    return !!s && (await teachesClass(user.id, s.classId));
  }
  if (user.role === "parent") {
    const [g] = await db
      .select({ s: guardiansStudents.studentId })
      .from(guardiansStudents)
      .where(and(eq(guardiansStudents.guardianId, user.id), eq(guardiansStudents.studentId, studentId)));
    return !!g;
  }
  return false;
}

export async function assertCanSeeStudent(user: UserSession, studentId: string): Promise<void> {
  if (!(await canSeeStudent(user, studentId))) throw forbidden();
}

/** Teacher may write for this (class, subject) only if a teacher_assignments row says so. Admin may always. */
export async function teachesClassSubject(user: UserSession, classId: string, subjectId: string): Promise<boolean> {
  if (user.role === "admin") return true;
  if (user.role !== "teacher") return false;
  const [ta] = await getDb()
    .select({ id: teacherAssignments.id })
    .from(teacherAssignments)
    .where(
      and(
        eq(teacherAssignments.teacherId, user.id),
        eq(teacherAssignments.classId, classId),
        eq(teacherAssignments.subjectId, subjectId)
      )
    );
  return !!ta;
}

/** Looks up a teacher_assignments row and asserts the user may write for it. Returns the row. */
export async function assertTeachesAssignment(user: UserSession, teacherAssignmentId: string) {
  const [ta] = await getDb()
    .select()
    .from(teacherAssignments)
    .where(eq(teacherAssignments.id, teacherAssignmentId));
  if (!ta) throw notFound("Course not found");
  if (!(await teachesClassSubject(user, ta.classId, ta.subjectId))) throw forbidden();
  return ta;
}

export async function assertTeachesSlot(user: UserSession, slotId: string) {
  const [slot] = await getDb().select().from(timetableSlots).where(eq(timetableSlots.id, slotId));
  if (!slot) throw notFound("Lesson slot not found");
  const ta = await assertTeachesAssignment(user, slot.teacherAssignmentId);
  return { slot, ta };
}
