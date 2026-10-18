import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { auditLog, classes, students, users } from "@/db/schema";
import { parseCsv, toCsv } from "@/lib/csv";
import { finalGrade, parseScale, DEFAULT_SCALE } from "@/lib/grading";
import { setupDb, resetDb } from "./helpers";
import * as login from "@/app/api/auth/login/route";
import * as passwordRoute from "@/app/api/auth/password/route";
import * as marksRoute from "@/app/api/marks/route";
import * as usersRoute from "@/app/api/admin/users/route";
import * as userRoute from "@/app/api/admin/users/[id]/route";
import * as classesRoute from "@/app/api/admin/classes/route";
import * as classRoute from "@/app/api/admin/classes/[id]/route";
import * as subjectsRoute from "@/app/api/admin/subjects/route";
import * as coursesRoute from "@/app/api/admin/courses/route";
import * as courseRoute from "@/app/api/admin/courses/[id]/route";
import * as timetableRoute from "@/app/api/admin/timetable/route";
import * as slotRoute from "@/app/api/admin/timetable/[id]/route";
import * as termsRoute from "@/app/api/terms/route";
import * as settingsRoute from "@/app/api/admin/settings/route";
import * as importRoute from "@/app/api/import/csv/route";
import * as gradesExport from "@/app/api/export/grades/route";
import * as attExport from "@/app/api/export/attendance/route";
import * as health from "@/app/api/health/route";

type Handler = (req: Request, ctx: never) => Promise<Response>;

async function loginAs(username: string, password = "Demo123!") {
  const res = await login.POST(new Request("http://localhost/api/auth/login", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }),
  }));
  expect(res.status).toBe(200);
  return res.headers.get("set-cookie")!.split(";")[0];
}

const call = (h: unknown, method: string, path: string, cookie: string, body?: unknown, id = "x") =>
  (h as Handler)(
    new Request(`http://localhost${path}`, {
      method, headers: { cookie, "content-type": "application/json" },
      body: body === undefined || method === "GET" ? undefined : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) } as never
  );

describe("csv + grading helpers", () => {
  it("parses quotes, commas, CRLF, BOM and blank lines", () => {
    const rows = parseCsv('﻿fullName,username\r\n"Valiyev, Ali",ali.v\r\n\r\n"O\'g""li",x\n');
    expect(rows).toEqual([["fullName", "username"], ["Valiyev, Ali", "ali.v"], ['O\'g"li', "x"]]);
  });
  it("writes CSV with a BOM, quoting, and defuses spreadsheet formulas", () => {
    const out = toCsv([["a", "b,c", '"q"'], ["=1+1", "+cmd", "-5"], [-5, null, "@x"]]);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toContain('a,"b,c","""q"""');
    expect(out).toContain("'=1+1,'+cmd,'-5"); // text starting with = + - @ is neutralised
    expect(out).toContain("-5,,'@x"); // real numbers are untouched
  });
  it("maps percentages to a 5-point grade and validates scales", () => {
    expect([100, 86, 85.9, 71, 70.9, 55, 54.9, 0].map((p) => finalGrade(p, DEFAULT_SCALE))).toEqual([5, 5, 4, 4, 3, 3, 2, 2]);
    expect(finalGrade(null, DEFAULT_SCALE)).toBeNull();
    expect(finalGrade(88.4, { mode: "percent" })).toBe(88);
    expect(parseScale({ mode: "five_point", thresholds: { five: 50, four: 60, three: 40 } })).toBeNull();
    expect(parseScale({ mode: "nope" })).toBeNull();
  });
});

describe("M5: admin pages are admin-only", () => {
  beforeAll(setupDb);
  it("teachers and students get 403 on every admin write", async () => {
    for (const who of ["jasur.rahimov", "azamat.toirov"]) {
      const c = await loginAs(who);
      for (const [h, m, p] of [
        [usersRoute.POST, "POST", "/api/admin/users"], [userRoute.PATCH, "PATCH", "/api/admin/users/usr-stu-01"],
        [classesRoute.GET, "GET", "/api/admin/classes"], [classesRoute.POST, "POST", "/api/admin/classes"],
        [classRoute.PATCH, "PATCH", "/api/admin/classes/cls-10a"], [subjectsRoute.POST, "POST", "/api/admin/subjects"],
        [coursesRoute.GET, "GET", "/api/admin/courses"], [coursesRoute.POST, "POST", "/api/admin/courses"],
        [courseRoute.DELETE, "DELETE", "/api/admin/courses/crs-10a-math"], [timetableRoute.POST, "POST", "/api/admin/timetable"],
        [slotRoute.DELETE, "DELETE", "/api/admin/timetable/slot-01"], [termsRoute.POST, "POST", "/api/terms"],
        [settingsRoute.PUT, "PUT", "/api/admin/settings"], [importRoute.POST, "POST", "/api/import/csv"],
      ] as const) {
        expect((await call(h, m, p, c, {})).status, `${who} ${m} ${p}`).toBe(403);
      }
    }
  });
  it("the health check is public and tiny", async () => {
    const res = await health.GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("M5: users", () => {
  beforeAll(setupDb);
  beforeEach(resetDb);

  it("creates accounts with validation; a generated password is shown once and must be changed", async () => {
    const admin = await loginAs("director");
    const create = (b: object) => call(usersRoute.POST, "POST", "/api/admin/users", admin, b);
    expect((await create({ username: "Bad Name!", fullName: "X", role: "teacher" })).status).toBe(400);
    expect((await create({ username: "new.teacher", fullName: "X", role: "king" })).status).toBe(400);
    expect((await create({ username: "new.student", fullName: "X", role: "student" })).status).toBe(400); // no class
    expect((await create({ username: "new.student", fullName: "X", role: "student", classId: "nope" })).status).toBe(400);
    expect((await create({ username: "jasur.rahimov", fullName: "X", role: "teacher" })).status).toBe(409);
    expect((await create({ username: "new.teacher", fullName: "X", role: "teacher", password: "short" })).status).toBe(400);

    const ok = await create({ username: "New.Student", fullName: "Nodir Karimov", role: "student", classId: "cls-10a" });
    expect(ok.status).toBe(201);
    const body = await ok.json();
    expect(body.user.username).toBe("new.student");
    expect(body.temporaryPassword).toHaveLength(12);

    const cookie = await loginAs("new.student", body.temporaryPassword);
    const blocked = await call(marksRoute.GET, "GET", "/api/marks", cookie);
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).code).toBe("PASSWORD_CHANGE_REQUIRED");
    const changed = await call(passwordRoute.POST, "POST", "/api/auth/password", cookie, { currentPassword: body.temporaryPassword, newPassword: "my-own-password-1" });
    expect(changed.status).toBe(200);
    expect((await call(marksRoute.GET, "GET", "/api/marks", changed.headers.get("set-cookie")!.split(";")[0])).status).toBe(200);
    expect((await getDb().select().from(auditLog).where(eq(auditLog.action, "user.create")))).toHaveLength(1);
    const [row] = await getDb().select().from(users).where(eq(users.username, "new.student"));
    expect(row.mustChangePassword).toBe(false);
  });

  it("a password given by the admin is not echoed back", async () => {
    const admin = await loginAs("director");
    const res = await call(usersRoute.POST, "POST", "/api/admin/users", admin, { username: "t.new", fullName: "T N", role: "teacher", password: "chosen-pass-1" });
    expect(res.status).toBe(201);
    expect(JSON.stringify(await res.json())).not.toContain("chosen-pass-1");
    await loginAs("t.new", "chosen-pass-1");
  });

  it("deactivating ends sessions and blocks login; reactivating restores it; admins can't remove themselves", async () => {
    const admin = await loginAs("director");
    const student = await loginAs("azamat.toirov");
    expect((await call(userRoute.PATCH, "PATCH", "/api/admin/users/usr-stu-01", admin, { active: false }, "usr-stu-01")).status).toBe(200);
    expect((await call(marksRoute.GET, "GET", "/api/marks", student)).status).toBe(401);
    expect((await login.POST(new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "azamat.toirov", password: "Demo123!" }) }))).status).toBe(401);
    expect((await call(userRoute.PATCH, "PATCH", "/api/admin/users/usr-stu-01", admin, { active: true }, "usr-stu-01")).status).toBe(200);
    await loginAs("azamat.toirov");
    expect((await call(userRoute.PATCH, "PATCH", "/api/admin/users/usr-dir-01", admin, { active: false }, "usr-dir-01")).status).toBe(400);
    expect((await call(userRoute.PATCH, "PATCH", "/api/admin/users/usr-dir-01", admin, { role: "teacher" }, "usr-dir-01")).status).toBe(400);
    expect((await call(userRoute.PATCH, "PATCH", "/api/admin/users/nope", admin, { active: false }, "nope")).status).toBe(404);
    expect((await getDb().select().from(auditLog).where(eq(auditLog.action, "user.deactivate")))).toHaveLength(1);
  });

  it("changing roles keeps the student/class tables and class-teacher links consistent", async () => {
    const admin = await loginAs("director");
    const patch = (id: string, b: object) => call(userRoute.PATCH, "PATCH", `/api/admin/users/${id}`, admin, b, id);
    expect((await patch("usr-stu-02", { classId: "cls-11a" })).status).toBe(200);
    expect((await getDb().select().from(students).where(eq(students.userId, "usr-stu-02")))[0].classId).toBe("cls-11a");
    expect((await patch("usr-stu-02", { role: "teacher" })).status).toBe(200);
    expect(await getDb().select().from(students).where(eq(students.userId, "usr-stu-02"))).toHaveLength(0);
    expect((await patch("usr-tch-03", { role: "student" })).status).toBe(400); // student needs a class
    // a teacher who still teaches courses cannot change role until those are reassigned
    const blocked = await patch("usr-tch-01", { role: "parent" });
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).error).toMatch(/still teaches 2 course/);
    for (const c of ["crs-10a-math", "crs-10a-cs"]) {
      expect((await call(courseRoute.PATCH, "PATCH", `/api/admin/courses/${c}`, admin, { teacherId: "usr-tch-03" }, c)).status).toBe(200);
    }
    // Jasur is class teacher of 10-A; demoting him must clear that link
    expect((await patch("usr-tch-01", { role: "parent" })).status).toBe(200);
    expect((await getDb().select().from(classes).where(eq(classes.id, "cls-10a")))[0].classTeacherId).toBeNull();
  });
});

describe("M5: classes, subjects, courses, timetable, terms, settings", () => {
  beforeAll(setupDb);
  beforeEach(resetDb);

  it("creates classes and appoints class teachers", async () => {
    const admin = await loginAs("director");
    expect((await call(classesRoute.POST, "POST", "/api/admin/classes", admin, { gradeLevel: 10, section: "a" })).status).toBe(409); // 10-A exists
    expect((await call(classesRoute.POST, "POST", "/api/admin/classes", admin, { gradeLevel: 13, section: "A" })).status).toBe(400);
    expect((await call(classesRoute.POST, "POST", "/api/admin/classes", admin, { gradeLevel: 8, section: "!!" })).status).toBe(400);
    const made = await call(classesRoute.POST, "POST", "/api/admin/classes", admin, { gradeLevel: 8, section: "b", classTeacherId: "usr-tch-02" });
    expect(made.status).toBe(201);
    expect((await made.json()).class.name).toBe("8-B");
    expect((await call(classesRoute.POST, "POST", "/api/admin/classes", admin, { gradeLevel: 8, section: "C", classTeacherId: "usr-stu-01" })).status).toBe(400);
    expect((await call(classRoute.PATCH, "PATCH", "/api/admin/classes/cls-10b", admin, { classTeacherId: "usr-tch-03" }, "cls-10b")).status).toBe(200);
    expect((await call(classRoute.PATCH, "PATCH", "/api/admin/classes/cls-10b", admin, { classTeacherId: "usr-dir-01" }, "cls-10b")).status).toBe(400);
    const list = (await (await call(classesRoute.GET, "GET", "/api/admin/classes", admin)).json()).classes;
    expect(list.find((c: { id: string }) => c.id === "cls-10a")).toMatchObject({ students: 2, classTeacherName: "Jasur Rahimov" });
  });

  it("subjects and teacher assignments", async () => {
    const admin = await loginAs("director");
    const s = await call(subjectsRoute.POST, "POST", "/api/admin/subjects", admin, { code: "bio-1", nameUz: "Biologiya", nameEn: "Biology" });
    expect(s.status).toBe(201);
    const subjectId = (await s.json()).subject.id;
    expect((await call(subjectsRoute.POST, "POST", "/api/admin/subjects", admin, { code: "BIO-1", nameUz: "x", nameEn: "y" })).status).toBe(409);
    const course = { teacherId: "usr-tch-02", classId: "cls-10a", subjectId };
    const made = await call(coursesRoute.POST, "POST", "/api/admin/courses", admin, course);
    expect(made.status).toBe(201);
    const id = (await made.json()).course.id;
    expect((await call(coursesRoute.POST, "POST", "/api/admin/courses", admin, course)).status).toBe(409);
    expect((await call(coursesRoute.POST, "POST", "/api/admin/courses", admin, { ...course, teacherId: "usr-stu-01", subjectId: "sbj-math" })).status).toBe(400);
    expect((await call(courseRoute.PATCH, "PATCH", `/api/admin/courses/${id}`, admin, { teacherId: "usr-tch-03" }, id)).status).toBe(200);
    expect((await call(courseRoute.DELETE, "DELETE", `/api/admin/courses/${id}`, admin, undefined, id)).status).toBe(200); // empty -> ok
    // a course with marks/attendance can never be deleted (it would erase them)
    expect((await call(courseRoute.DELETE, "DELETE", "/api/admin/courses/crs-10a-math", admin, undefined, "crs-10a-math")).status).toBe(409);
    expect((await call(courseRoute.DELETE, "DELETE", "/api/admin/courses/nope", admin, undefined, "nope")).status).toBe(404);
  });

  it("timetable slots: validation, no double-booking, and no deleting slots with attendance", async () => {
    const admin = await loginAs("director");
    const slot = (b: object) => call(timetableRoute.POST, "POST", "/api/admin/timetable", admin, { courseId: "crs-10a-eng", dayOfWeek: 3, startTime: "09:00", endTime: "09:45", room: "101", ...b });
    expect((await slot({ dayOfWeek: 9 })).status).toBe(400);
    expect((await slot({ startTime: "9:00" })).status).toBe(400);
    expect((await slot({ startTime: "10:00", endTime: "09:00" })).status).toBe(400);
    const ok = await slot({});
    expect(ok.status).toBe(201);
    const id = (await ok.json()).slot.id;
    expect((await slot({ startTime: "09:30", endTime: "10:15" })).status).toBe(409); // same class overlaps
    expect((await slot({ courseId: "crs-10a-phys", startTime: "09:30", endTime: "10:15" })).status).toBe(409); // same class, other subject
    expect((await slot({ startTime: "09:45", endTime: "10:30" })).status).toBe(201); // back-to-back is fine
    expect(id).toBeTruthy();
    // a teacher cannot be in two classes at once either
    const other = await call(coursesRoute.POST, "POST", "/api/admin/courses", admin, { teacherId: "usr-tch-02", classId: "cls-10b", subjectId: "sbj-math" });
    const busy = (await other.json()).course.id;
    expect((await slot({ courseId: busy, startTime: "09:10", endTime: "09:30" })).status).toBe(409);
    const free = await call(coursesRoute.POST, "POST", "/api/admin/courses", admin, { teacherId: "usr-tch-03", classId: "cls-10b", subjectId: "sbj-eng" });
    expect((await slot({ courseId: (await free.json()).course.id, startTime: "09:10", endTime: "09:30" })).status).toBe(201);
  });

  it("deleting a slot works only while it has no attendance", async () => {
    const admin = await loginAs("director");
    expect((await call(slotRoute.DELETE, "DELETE", "/api/admin/timetable/slot-01", admin, undefined, "slot-01")).status).toBe(409);
    const made = await call(timetableRoute.POST, "POST", "/api/admin/timetable", admin, { courseId: "crs-10a-eng", dayOfWeek: 5, startTime: "13:00", endTime: "13:45", room: "9" });
    const id = (await made.json()).slot.id;
    expect((await call(slotRoute.DELETE, "DELETE", `/api/admin/timetable/${id}`, admin, undefined, id)).status).toBe(200);
    expect((await call(slotRoute.DELETE, "DELETE", `/api/admin/timetable/${id}`, admin, undefined, id)).status).toBe(404);
  });

  it("terms: create, reject overlaps and bad dates", async () => {
    const admin = await loginAs("director");
    const term = (b: object) => call(termsRoute.POST, "POST", "/api/terms", admin, b);
    expect((await term({ name: "Term 3", startDate: "2027-04-01", endDate: "2027-06-15" })).status).toBe(201);
    expect((await term({ name: "Bad", startDate: "2027-05-01", endDate: "2027-05-20" })).status).toBe(409);
    expect((await term({ name: "Bad", startDate: "2027-07-01", endDate: "2027-06-20" })).status).toBe(400);
    expect((await term({ name: "", startDate: "2027-07-01", endDate: "2027-07-20" })).status).toBe(400);
  });

  it("grading scale: anyone reads it, only admins change it, bad scales are refused", async () => {
    const admin = await loginAs("director");
    const read = async (c: string) => (await (await call(settingsRoute.GET, "GET", "/api/admin/settings", c)).json()).gradingScale;
    expect((await read(await loginAs("azamat.toirov"))).mode).toBe("five_point");
    expect((await call(settingsRoute.PUT, "PUT", "/api/admin/settings", admin, { gradingScale: { mode: "five_point", thresholds: { five: 50, four: 60, three: 40 } } })).status).toBe(400);
    expect((await call(settingsRoute.PUT, "PUT", "/api/admin/settings", admin, { gradingScale: { mode: "percent" } })).status).toBe(200);
    expect(await read(await loginAs("jasur.rahimov"))).toEqual({ mode: "percent" });
    expect((await getDb().select().from(auditLog).where(eq(auditLog.action, "settings.grading_scale")))).toHaveLength(1);
  });
});

const FILE = (rows: string[]) => ["fullName,username,gradeLevel,section", ...rows].join("\n");

describe("M5: class-list CSV import", () => {
  beforeAll(setupDb);
  beforeEach(resetDb);
  const imp = (cookie: string, csvContent: string, isDryRun: boolean) =>
    call(importRoute.POST, "POST", "/api/import/csv", cookie, { entityType: "students", csvContent, isDryRun });

  it("dry run previews without writing; the real run imports everything and returns one-time passwords", async () => {
    const admin = await loginAs("director");
    const csv = FILE(['"Valiyev, Ali",ali.valiyev,9,a', "Nilufar Yoqubova,nilufar.y,9,A", "Sardor Aliyev,sardor.a,5,B"]);
    const dry = await (await imp(admin, csv, true)).json();
    expect(dry).toMatchObject({ success: true, isDryRun: true, totalRows: 3, classes: ["5-B", "9-A"] });
    expect(await getDb().select().from(users).where(eq(users.username, "ali.valiyev"))).toHaveLength(0);

    const res = await (await imp(admin, csv, false)).json();
    expect(res).toMatchObject({ success: true, created: 3, createdClasses: 2 });
    const creds = parseCsv(res.credentialsCsv);
    expect(creds[0]).toEqual(["fullName", "username", "class", "temporaryPassword"]);
    expect(creds[1].slice(0, 3)).toEqual(["Valiyev, Ali", "ali.valiyev", "9-A"]);
    const cookie = await loginAs("ali.valiyev", creds[1][3]);
    expect((await call(marksRoute.GET, "GET", "/api/marks", cookie)).status).toBe(403); // must change password first
    const [u] = await getDb().select().from(users).where(eq(users.username, "ali.valiyev"));
    expect((await getDb().select().from(students).where(eq(students.userId, u.id)))).toHaveLength(1);
    // importing the same file again is refused (usernames exist)
    expect((await imp(admin, csv, false)).status).toBe(422);
  });

  it("reports every problem and writes nothing when any row is bad", async () => {
    const admin = await loginAs("director");
    const csv = FILE(["Ok One,ok.one,9,A", "No User,,9,A", "Dup,ok.one,9,A", "Existing,azamat.toirov,10,A", "Grade,g.rade,99,A", "Sect,s.ect,9,TOOLONG"]);
    const res = await imp(admin, csv, false);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.errors.join("\n")).toMatch(/Row 3.*username/);
    expect(body.errors.join("\n")).toMatch(/Row 4.*repeated/);
    expect(body.errors.join("\n")).toMatch(/Row 5.*already exists/);
    expect(body.errors.join("\n")).toMatch(/Row 6.*grade level/);
    expect(body.errors.join("\n")).toMatch(/Row 7.*section/);
    expect(await getDb().select().from(users).where(eq(users.username, "ok.one"))).toHaveLength(0);
    expect(await getDb().select().from(classes).where(eq(classes.name, "9-A"))).toHaveLength(0);
  });

  it("rejects wrong shapes", async () => {
    const admin = await loginAs("director");
    expect((await imp(admin, "fullName,username\nA,a.a", true)).status).toBe(400);
    expect((await imp(admin, "fullName,username,gradeLevel,section", true)).status).toBe(400);
    expect((await call(importRoute.POST, "POST", "/api/import/csv", admin, { entityType: "teachers", csvContent: "x" })).status).toBe(400);
  });
});

describe("M5: CSV exports", () => {
  beforeAll(setupDb);

  const get = (h: unknown, path: string, cookie: string) => call(h, "GET", path, cookie);

  it("grades: admin and class teacher get everything, a subject teacher only their subject", async () => {
    const admin = await get(gradesExport.GET, "/api/export/grades?classId=cls-10a", await loginAs("director"));
    expect(admin.status).toBe(200);
    expect(admin.headers.get("content-type")).toContain("text/csv");
    const bytes = new Uint8Array(await admin.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM so Excel reads Uzbek letters
    const rows = parseCsv(new TextDecoder().decode(bytes));
    expect(rows[0]).toContain("Percent");
    expect(rows.slice(1)).toHaveLength(6); // 3 assessments x 2 students
    expect(rows.find((r) => r[1] === "Azamat Toirov" && r[6] === "Midterm")!.slice(9, 12)).toEqual(["91", "100", "91"]);

    const classTeacher = parseCsv(await (await get(gradesExport.GET, "/api/export/grades?classId=cls-10a&termId=term-2026-1", await loginAs("jasur.rahimov"))).text());
    expect(classTeacher.slice(1)).toHaveLength(6);
    const physics = parseCsv(await (await get(gradesExport.GET, "/api/export/grades?classId=cls-10a", await loginAs("bobur.alimov"))).text());
    expect(physics.slice(1).map((r) => r[4])).toEqual(["Physics & Mechanics", "Physics & Mechanics"]);
  });

  it("grades: students, unrelated teachers and bad ids are refused", async () => {
    expect((await get(gradesExport.GET, "/api/export/grades?classId=cls-10a", await loginAs("azamat.toirov"))).status).toBe(403);
    expect((await get(gradesExport.GET, "/api/export/grades?classId=cls-10b", await loginAs("jasur.rahimov"))).status).toBe(403);
    expect((await get(gradesExport.GET, "/api/export/grades", await loginAs("director"))).status).toBe(400);
    expect((await get(gradesExport.GET, "/api/export/grades?classId=cls-10a&termId=nope", await loginAs("director"))).status).toBe(400);
  });

  it("attendance: class teacher or admin only", async () => {
    const path = "/api/export/attendance?classId=cls-10a&from=2026-10-01&to=2026-10-18";
    const csv = parseCsv(await (await get(attExport.GET, path, await loginAs("jasur.rahimov"))).text());
    expect(csv.slice(1)).toHaveLength(3); // seed: 3 attendance rows on 2026-10-16
    expect(csv[1]).toContain("present");
    expect((await get(attExport.GET, path, await loginAs("director"))).status).toBe(200);
    expect((await get(attExport.GET, path, await loginAs("bobur.alimov"))).status).toBe(403);
    expect((await get(attExport.GET, path, await loginAs("azamat.toirov"))).status).toBe(403);
    expect((await get(attExport.GET, "/api/export/attendance?classId=cls-10a&from=2026-10-18&to=2026-10-01", await loginAs("director"))).status).toBe(400);
  });
});
