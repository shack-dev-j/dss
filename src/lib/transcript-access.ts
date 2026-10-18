import { canSeeStudent, forbidden, isClassTeacherOf } from "@/lib/authz";
import { isFeatureEnabled } from "@/lib/env";
import type { UserSession } from "@/types";

/**
 * A transcript is more sensitive than a single mark: only the student, their class teacher, an
 * administrator, or (when the guardian module is on) a linked parent. Subject teachers do not get it.
 */
export async function assertCanSeeTranscript(user: UserSession, studentId: string): Promise<void> {
  if (user.role === "admin") return;
  if (user.role === "student" && user.id === studentId) return;
  if (user.role === "teacher" && (await isClassTeacherOf(user, studentId))) return;
  if (user.role === "parent" && isFeatureEnabled("guardian") && (await canSeeStudent(user, studentId))) return;
  throw forbidden();
}
