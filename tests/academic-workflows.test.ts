import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { db } from "@/db";
import { setupDb, resetDb } from "./helpers";

describe("Academic & Operational Workflows Integration", () => {
  beforeAll(setupDb);
  beforeEach(resetDb);

  it("retrieves personal timetable for a Grade 10-A student in Asia/Tashkent timezone", async () => {
    const slots = await db.getTimetableForStudent(10, "A");
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].room).toBeDefined();
    expect(slots[0].startTime).toBeDefined();
    expect(slots[0].teacherName).toBeDefined();
  });

  it("handles assignment creation, student submission, and teacher grading end-to-end", async () => {
    // 1. Teacher creates assignment
    const newAsg = await db.createAssignment({
      courseId: "crs-10a-math",
      title: "Integrallar va hosilalar amaliyoti",
      instructions: "Hosilalar formulalarini isbotlang.",
      dueDate: "2026-11-01T23:59:00",
      estimatedMinutes: 60,
    });

    expect(newAsg.id).toBeDefined();
    expect(newAsg.title).toBe("Integrallar va hosilalar amaliyoti");

    // 2. Student submits work
    const submission = await db.submitAssignment(
      newAsg.id,
      "usr-stu-01",
      "Yechimlar to'liq daftarga yozildi va havola biriktirildi."
    );

    expect(submission.id).toBeDefined();
    expect(submission.status).toBe("submitted");

    // 3. Teacher grades submission and gives written feedback
    const graded = await db.gradeSubmission(
      submission.id,
      98,
      "Mukammal yechim! Barcha qadamlar aniq ko'rsatilgan."
    );

    expect(graded.status).toBe("graded");
    expect(graded.grade).toBe(98);
    expect(graded.feedback).toBe("Mukammal yechim! Barcha qadamlar aniq ko'rsatilgan.");
  });

  it("records and updates session attendance", async () => {
    const today = "2026-10-17";
    await db.markAttendance([
      {
        slotId: "slot-01",
        studentId: "usr-stu-01",
        date: today,
        status: "present",
      },
      {
        slotId: "slot-01",
        studentId: "usr-stu-02",
        date: today,
        status: "late",
        notes: "Transport kechikishi tufayli 5 daqiqa kech qoldi",
      },
    ], "usr-tch-01");

    const records = await db.getAttendanceForSlotAndDate("slot-01", today);
    expect(records.length).toBe(2);
    expect(records.find((r) => r.studentId === "usr-stu-02")?.status).toBe("late");
  });

  it("resets demo state back to pristine fictional data without data loss", async () => {
    // Submit a new suggestion
    await db.submitAnonymousSuggestion("general", "Test taklif", "Test matni");
    const beforeReset = await db.getAllAnonymousSuggestions();
    expect(beforeReset.length).toBeGreaterThan(2);

    // Reset demo state
    await db.resetDemoData();
    const afterReset = await db.getAllAnonymousSuggestions();
    expect(afterReset.length).toBe(2); // Initial seed count
  });
});
