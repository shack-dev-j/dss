CREATE TABLE "attendance_backdate_approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"slot_id" text NOT NULL,
	"date" varchar(10) NOT NULL,
	"approved_by" text NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_backdate_approvals_slot_id_date_unique" UNIQUE("slot_id","date")
);
--> statement-breakpoint
CREATE TABLE "homework" (
	"id" text PRIMARY KEY NOT NULL,
	"teacher_assignment_id" text NOT NULL,
	"description" text NOT NULL,
	"due_date" varchar(10) NOT NULL,
	"attachment_file" varchar(100),
	"attachment_name" varchar(255),
	"posted_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homework_done" (
	"homework_id" text NOT NULL,
	"student_id" text NOT NULL,
	"done_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "homework_done_homework_id_student_id_unique" UNIQUE("homework_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "attendance_backdate_approvals" ADD CONSTRAINT "attendance_backdate_approvals_slot_id_timetable_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."timetable_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_backdate_approvals" ADD CONSTRAINT "attendance_backdate_approvals_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework" ADD CONSTRAINT "homework_teacher_assignment_id_teacher_assignments_id_fk" FOREIGN KEY ("teacher_assignment_id") REFERENCES "public"."teacher_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework" ADD CONSTRAINT "homework_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_done" ADD CONSTRAINT "homework_done_homework_id_homework_id_fk" FOREIGN KEY ("homework_id") REFERENCES "public"."homework"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_done" ADD CONSTRAINT "homework_done_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;