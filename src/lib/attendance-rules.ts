import { db } from "@/db";
import { earliestEditableDate, schoolDate, BACKDATE_WINDOW_DAYS } from "@/lib/dates";
import { HttpError } from "@/lib/authz";
import type { UserSession } from "@/types";

export interface Editability {
  editable: boolean;
  reason?: "future" | "needs_approval";
  message?: string;
}

/**
 * Attendance can be recorded for lessons up to 7 days back (school time). Older lessons need an
 * admin's approval for that exact lesson (slot + date); admins themselves are never blocked.
 * Lessons in the future can't be recorded by anyone.
 */
export async function lessonEditability(user: UserSession, slotId: string, date: string, now: Date = new Date()): Promise<Editability> {
  if (date > schoolDate(now)) return { editable: false, reason: "future", message: "Cannot record attendance for a future date" };
  if (date >= earliestEditableDate(now) || user.role === "admin") return { editable: true };
  if (await db.hasBackdateApproval(slotId, date)) return { editable: true };
  return {
    editable: false,
    reason: "needs_approval",
    message: `Attendance older than ${BACKDATE_WINDOW_DAYS} days can only be changed after an administrator approves it`,
  };
}

export async function assertLessonEditable(user: UserSession, slotId: string, date: string, now?: Date) {
  const e = await lessonEditability(user, slotId, date, now);
  if (!e.editable) throw new HttpError(e.reason === "future" ? 400 : 403, e.message!);
}
