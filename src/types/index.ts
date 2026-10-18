export type UserRole = "admin" | "teacher" | "student" | "parent";

export interface UserSession {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  classId?: string;    // students
  gradeLevel?: number; // students
  section?: string;    // students, e.g. "A"
  mustChangePassword?: boolean; // set by import / admin reset until the user picks their own password
}

export type SuggestionStatus =
  | "received"
  | "under_review"
  | "approved"
  | "denied"
  | "in_progress"
  | "implemented"
  | "closed";

export interface AnonymousSuggestionRecord {
  id: string;
  receiptCode: string;
  category: "academic" | "facilities" | "catering" | "events" | "general";
  title: string;
  content: string;
  status: SuggestionStatus;
  officialResponse?: string | null;
  respondedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimetableSlot {
  id: string;
  dayOfWeek: number; // 1 = Monday, 5 = Friday
  startTime: string; // "08:30"
  endTime: string;   // "09:15"
  subjectName: string;
  teacherName: string;
  room: string;
  gradeLevel: number;
  section: string;
}

export interface AssignmentItem {
  id: string;
  courseId: string;
  subjectName: string;
  title: string;
  instructions: string;
  dueDate: string;
  estimatedMinutes: number;
  rubricJson?: { criteria: string; maxPoints: number }[];
  status: "draft" | "published" | "closed";
  teacherId: string;
  teacherName: string;
  gradeLevel: number;
  section: string;
}

export interface SubmissionItem {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  content: string;
  submittedAt: string;
  grade?: number;
  maxScore?: number;
  feedback?: string;
  status: "submitted" | "graded" | "late";
}

export interface AttendanceRecord {
  id: string;
  date: string;
  slotId: string;
  studentId: string;
  studentName: string;
  status: "present" | "absent" | "late" | "excused";
  notes?: string;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  authorName: string;
  targetAudience: "all" | "staff" | "class" | "students";
  priority: "urgent" | "normal" | "info";
  createdAt: string;
}

export interface PolicyDocument {
  id: string;
  title: string;
  category: "handbook" | "academic" | "behavior" | "it" | "facilities";
  content: string;
  version: string;
  effectiveDate: string;
}

export interface SupportTicket {
  id: string;
  reporterName: string;
  category: "it" | "facilities" | "smartboard";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  status: "open" | "in_progress" | "resolved" | "closed";
  createdAt: string;
}

export interface SchoolEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  category: "assembly" | "olympiad" | "club" | "workshop";
  capacity: number;
  registeredCount: number;
}
