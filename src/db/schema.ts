import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at").defaultNow().notNull();

// ---------------------------------------------------------------------------
// Identity & sessions
// ---------------------------------------------------------------------------

// Roles: admin | teacher | student | parent (parent is v2, feature-flagged).
// "Class teacher" is a relationship (classes.class_teacher_id), not a role.
export const users = pgTable("users", {
  id: id(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").default(true).notNull(),
  mustChangePassword: boolean("must_change_password").default(false).notNull(),
  createdAt: createdAt(),
});

// Server-side sessions. `id` is HMAC-SHA256(token, SESSION_SECRET); the raw
// token only ever lives in the httpOnly cookie.
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)]
);

export const guardiansStudents = pgTable(
  "guardians_students",
  {
    guardianId: text("guardian_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    studentId: text("student_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  },
  (t) => [unique().on(t.guardianId, t.studentId)]
);

// ---------------------------------------------------------------------------
// Academic structure
// ---------------------------------------------------------------------------

export const academicYears = pgTable("academic_years", {
  id: id(),
  name: varchar("name", { length: 100 }).notNull(),
  startDate: varchar("start_date", { length: 10 }).notNull(),
  endDate: varchar("end_date", { length: 10 }).notNull(),
});

export const terms = pgTable("terms", {
  id: id(),
  yearId: text("year_id").references(() => academicYears.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  startDate: varchar("start_date", { length: 10 }).notNull(),
  endDate: varchar("end_date", { length: 10 }).notNull(),
  closed: boolean("closed").default(false).notNull(),
});

export const classes = pgTable("classes", {
  id: id(),
  name: varchar("name", { length: 20 }).notNull(), // "10-A"
  gradeLevel: integer("grade_level").notNull(),
  section: varchar("section", { length: 10 }).notNull(),
  yearId: text("year_id").references(() => academicYears.id).notNull(),
  classTeacherId: text("class_teacher_id").references(() => users.id),
});

export const students = pgTable("students", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  classId: text("class_id").references(() => classes.id).notNull(),
});

export const subjects = pgTable("subjects", {
  id: id(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  nameUz: varchar("name_uz", { length: 255 }).notNull(),
  nameEn: varchar("name_en", { length: 255 }).notNull(),
});

// Which teacher teaches which subject to which class. All teacher write
// permissions are derived from this table.
export const teacherAssignments = pgTable(
  "teacher_assignments",
  {
    id: id(),
    teacherId: text("teacher_id").references(() => users.id).notNull(),
    classId: text("class_id").references(() => classes.id, { onDelete: "cascade" }).notNull(),
    subjectId: text("subject_id").references(() => subjects.id, { onDelete: "cascade" }).notNull(),
  },
  (t) => [unique().on(t.classId, t.subjectId)]
);

export const timetableSlots = pgTable("timetable_slots", {
  id: id(),
  teacherAssignmentId: text("teacher_assignment_id")
    .references(() => teacherAssignments.id, { onDelete: "cascade" })
    .notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 1 = Mon .. 5 = Fri
  startTime: varchar("start_time", { length: 10 }).notNull(),
  endTime: varchar("end_time", { length: 10 }).notNull(),
  room: varchar("room", { length: 50 }).notNull(),
});

// ---------------------------------------------------------------------------
// Assignments (coursework with submissions) — pre-existing feature
// ---------------------------------------------------------------------------

export const assignments = pgTable("assignments", {
  id: id(),
  teacherAssignmentId: text("teacher_assignment_id")
    .references(() => teacherAssignments.id, { onDelete: "cascade" })
    .notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  instructions: text("instructions").notNull(),
  dueDate: timestamp("due_date").notNull(),
  estimatedMinutes: integer("estimated_minutes").default(45).notNull(),
  status: varchar("status", { length: 20 }).default("published").notNull(),
  createdAt: createdAt(),
});

export const submissions = pgTable(
  "submissions",
  {
    id: id(),
    assignmentId: text("assignment_id").references(() => assignments.id, { onDelete: "cascade" }).notNull(),
    studentId: text("student_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    content: text("content").notNull(),
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
    grade: integer("grade"),
    maxScore: integer("max_score").default(100).notNull(),
    feedback: text("feedback"),
    status: varchar("status", { length: 20 }).default("submitted").notNull(),
  },
  (t) => [unique().on(t.assignmentId, t.studentId)]
);

// ---------------------------------------------------------------------------
// Assessments & marks (M2 builds the UI on top of these)
// ---------------------------------------------------------------------------

export const assessments = pgTable("assessments", {
  id: id(),
  teacherAssignmentId: text("teacher_assignment_id")
    .references(() => teacherAssignments.id, { onDelete: "cascade" })
    .notNull(),
  termId: text("term_id").references(() => terms.id).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // quiz | test | homework_check | exam
  title: varchar("title", { length: 255 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  maxScore: integer("max_score").notNull(),
});

export const marks = pgTable(
  "marks",
  {
    id: id(),
    assessmentId: text("assessment_id").references(() => assessments.id, { onDelete: "cascade" }).notNull(),
    studentId: text("student_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    score: integer("score").notNull(),
    comment: text("comment"),
    updatedBy: text("updated_by").references(() => users.id).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.assessmentId, t.studentId)]
);

// ---------------------------------------------------------------------------
// Attendance (per timetable slot and date)
// ---------------------------------------------------------------------------

export const attendance = pgTable(
  "attendance",
  {
    id: id(),
    slotId: text("slot_id").references(() => timetableSlots.id, { onDelete: "cascade" }).notNull(),
    studentId: text("student_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
    status: varchar("status", { length: 20 }).notNull(), // present | absent | late | excused
    notes: text("notes"),
    recordedBy: text("recorded_by").references(() => users.id).notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.slotId, t.studentId, t.date)]
);

// An admin lets teachers edit one lesson's attendance after the 7-day window.
export const attendanceBackdateApprovals = pgTable(
  "attendance_backdate_approvals",
  {
    id: id(),
    slotId: text("slot_id").references(() => timetableSlots.id, { onDelete: "cascade" }).notNull(),
    date: varchar("date", { length: 10 }).notNull(),
    approvedBy: text("approved_by").references(() => users.id).notNull(),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.slotId, t.date)]
);

// ---------------------------------------------------------------------------
// Homework (class + subject, optional attachment stored on the local disk volume)
// ---------------------------------------------------------------------------

export const homework = pgTable("homework", {
  id: id(),
  teacherAssignmentId: text("teacher_assignment_id")
    .references(() => teacherAssignments.id, { onDelete: "cascade" })
    .notNull(),
  description: text("description").notNull(),
  dueDate: varchar("due_date", { length: 10 }).notNull(), // YYYY-MM-DD
  attachmentFile: varchar("attachment_file", { length: 100 }), // generated name inside UPLOAD_DIR
  attachmentName: varchar("attachment_name", { length: 255 }), // sanitized original name, for download
  postedBy: text("posted_by").references(() => users.id).notNull(),
  createdAt: createdAt(),
});

export const homeworkDone = pgTable(
  "homework_done",
  {
    homeworkId: text("homework_id").references(() => homework.id, { onDelete: "cascade" }).notNull(),
    studentId: text("student_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    doneAt: timestamp("done_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.homeworkId, t.studentId)]
);

// Small key/value store for school-wide settings (e.g. grading scale).
export const settings = pgTable("settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: text("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const auditLog = pgTable("audit_log", {
  id: id(),
  userId: text("user_id").references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  entity: varchar("entity", { length: 50 }).notNull(),
  entityId: varchar("entity_id", { length: 100 }).notNull(),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Announcements (in scope) and out-of-scope modules (hidden by FEATURES)
// ---------------------------------------------------------------------------

export const announcements = pgTable("announcements", {
  id: id(),
  authorId: text("author_id").references(() => users.id),
  authorName: varchar("author_name", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  targetAudience: varchar("target_audience", { length: 50 }).default("all").notNull(),
  priority: varchar("priority", { length: 20 }).default("normal").notNull(),
  createdAt: createdAt(),
});

// NO user_id / student_id / ip columns, by design.
export const anonymousSuggestions = pgTable("anonymous_suggestions", {
  id: id(),
  receiptCode: varchar("receipt_code", { length: 50 }).notNull().unique(),
  secretHash: text("secret_hash").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  status: varchar("status", { length: 30 }).default("received").notNull(),
  officialResponse: text("official_response"),
  respondedAt: timestamp("responded_at"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const policies = pgTable("policies", {
  id: id(),
  title: varchar("title", { length: 255 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  content: text("content").notNull(),
  version: varchar("version", { length: 20 }).default("1.0").notNull(),
  effectiveDate: varchar("effective_date", { length: 30 }).notNull(),
});

export const events = pgTable("events", {
  id: id(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  date: varchar("date", { length: 30 }).notNull(),
  time: varchar("time", { length: 30 }).notNull(),
  location: varchar("location", { length: 100 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  capacity: integer("capacity").default(100).notNull(),
  registeredCount: integer("registered_count").default(0).notNull(),
});

export const clubs = pgTable("clubs", {
  id: id(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  leaderName: varchar("leader_name", { length: 255 }).notNull(),
  meetingSchedule: varchar("meeting_schedule", { length: 255 }).notNull(),
  memberCount: integer("member_count").default(0).notNull(),
});

export const studentProjects = pgTable("student_projects", {
  id: id(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  status: varchar("status", { length: 30 }).default("active").notNull(),
  leadStudentId: text("lead_student_id").references(() => users.id),
  leadStudentName: varchar("lead_student_name", { length: 255 }).notNull(),
  mentorName: varchar("mentor_name", { length: 255 }).notNull(),
  milestones: jsonb("milestones").$type<{ title: string; done: boolean }[]>().notNull(),
});

export const supportTickets = pgTable("support_tickets", {
  id: id(),
  reporterId: text("reporter_id").references(() => users.id),
  reporterName: varchar("reporter_name", { length: 255 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  priority: varchar("priority", { length: 20 }).default("medium").notNull(),
  status: varchar("status", { length: 30 }).default("open").notNull(),
  createdAt: createdAt(),
});
