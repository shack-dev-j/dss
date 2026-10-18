import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { db } from "@/db";
import { getDb } from "@/db/client";
import { sessions, users, attendance, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { assertEnv, ConfigError } from "@/lib/env";
import { setupDb, resetDb } from "./helpers";
import * as login from "@/app/api/auth/login/route";
import * as logout from "@/app/api/auth/logout/route";
import * as me from "@/app/api/auth/me/route";
import * as password from "@/app/api/auth/password/route";
import * as demoLogin from "@/app/api/auth/demo-login/route";
import * as marks from "@/app/api/marks/route";
import * as attendanceRoute from "@/app/api/attendance/route";
import * as assignmentsRoute from "@/app/api/assignments/route";
import * as gradeRoute from "@/app/api/assignments/grade/route";
import * as submitRoute from "@/app/api/assignments/submit/route";
import * as reviewRoute from "@/app/api/suggestions/review/route";
import * as csvRoute from "@/app/api/import/csv/route";
import * as resetRoute from "@/app/api/demo/reset/route";
import * as ticketsRoute from "@/app/api/tickets/route";
import * as submitGet from "@/app/api/assignments/submit/route";
import * as adminUsers from "@/app/api/admin/users/route";
import * as adminPassword from "@/app/api/admin/users/[id]/password/route";

const PASSWORD = "Demo123!";
type Handler = (req: Request, ctx: never) => Promise<Response>;

function req(method: string, path: string, opts: { cookie?: string; body?: unknown } = {}) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { ...(opts.cookie ? { cookie: opts.cookie } : {}), "content-type": "application/json" },
    body: opts.body === undefined || method === "GET" ? undefined : JSON.stringify(opts.body),
  });
}

async function loginAs(username: string, pw = PASSWORD): Promise<string> {
  const res = await login.POST(req("POST", "/api/auth/login", { body: { username, password: pw } }));
  expect(res.status).toBe(200);
  const setCookie = res.headers.get("set-cookie")!;
  return setCookie.split(";")[0];
}

const call = (h: unknown, method: string, path: string, opts: { cookie?: string; body?: unknown } = {}) =>
  (h as Handler)(req(method, path, opts), undefined as never);

describe("Authentication: every route requires a session", () => {
  beforeAll(setupDb);

  const routeModules = (import.meta as unknown as {
    glob: (p: string) => Record<string, () => Promise<unknown>>;
  }).glob("../src/app/api/**/route.ts");
  const PUBLIC = ["auth/login", "auth/demo-login", "health"];

  it("discovers the route files", () => {
    expect(Object.keys(routeModules).length).toBeGreaterThan(15);
  });

  it("returns 401 for every exported method of every route when there is no cookie", async () => {
    const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
    let checked = 0;
    for (const [file, load] of Object.entries(routeModules)) {
      const rel = file.replace("../src/app/api/", "").replace("/route.ts", "");
      if (PUBLIC.includes(rel)) continue;
      const mod = (await load()) as Record<string, unknown>;
      for (const m of METHODS) {
        if (typeof mod[m] !== "function") continue;
        const res = await (mod[m] as Handler)(req(m, `/api/${rel}`, { body: {} }), {
          params: Promise.resolve({ id: "x" }),
        } as never);
        expect(res.status, `${m} /api/${rel}`).toBe(401);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it("rejects forged, malformed and unknown session cookies", async () => {
    for (const cookie of ["namps_session=abc", "namps_session=", "namps_session=%00", "other=1"]) {
      expect((await me.GET(req("GET", "/api/auth/me", { cookie }))).status).toBe(401);
    }
  });
});

describe("Login, sessions and logout", () => {
  beforeAll(setupDb);
  beforeEach(resetDb);

  it("logs in with a username and sets an httpOnly SameSite cookie, storing only a hash server-side", async () => {
    const res = await login.POST(req("POST", "/api/auth/login", { body: { username: "Azamat.Toirov", password: PASSWORD } }));
    expect(res.status).toBe(200);
    const header = res.headers.get("set-cookie")!;
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Lax/i);
    const token = decodeURIComponent(header.split(";")[0].split("=")[1]);
    const rows = await getDb().select().from(sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).not.toBe(token); // raw token is never stored
  });

  it("rejects wrong passwords and unknown users with the same 401", async () => {
    const bad = await login.POST(req("POST", "/api/auth/login", { body: { username: "azamat.toirov", password: "nope" } }));
    const unknown = await login.POST(req("POST", "/api/auth/login", { body: { username: "ghost", password: "nope" } }));
    expect(bad.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await bad.json()).toEqual(await unknown.json());
  });

  it("an old cookie fails after logout", async () => {
    const cookie = await loginAs("azamat.toirov");
    expect((await me.GET(req("GET", "/api/auth/me", { cookie }))).status).toBe(200);
    const out = await logout.POST(req("POST", "/api/auth/logout", { cookie }), undefined as never);
    expect(out.status).toBe(200);
    expect(out.headers.get("set-cookie")).toMatch(/Max-Age=0/);
    expect((await me.GET(req("GET", "/api/auth/me", { cookie }))).status).toBe(401);
    expect((await call(marks.GET, "GET", "/api/marks", { cookie })).status).toBe(401);
  });

  it("expired and deactivated sessions are rejected", async () => {
    const cookie = await loginAs("azamat.toirov");
    await getDb().update(sessions).set({ expiresAt: new Date(Date.now() - 1000) });
    expect((await me.GET(req("GET", "/api/auth/me", { cookie }))).status).toBe(401);

    const cookie2 = await loginAs("azamat.toirov");
    await getDb().update(users).set({ active: false }).where(eq(users.username, "azamat.toirov"));
    expect((await me.GET(req("GET", "/api/auth/me", { cookie: cookie2 }))).status).toBe(401);
  });

  it("changing a password ends all older sessions; admin reset does too", async () => {
    const old = await loginAs("madina.zaripova");
    const res = await call(password.POST, "POST", "/api/auth/password", {
      cookie: old, body: { currentPassword: PASSWORD, newPassword: "a-new-password-1" },
    });
    expect(res.status).toBe(200);
    expect((await me.GET(req("GET", "/api/auth/me", { cookie: old }))).status).toBe(401);
    await loginAs("madina.zaripova", "a-new-password-1");

    const wrong = await call(password.POST, "POST", "/api/auth/password", {
      cookie: await loginAs("madina.zaripova", "a-new-password-1"),
      body: { currentPassword: "bad", newPassword: "another-password-1" },
    });
    expect(wrong.status).toBe(403);

    const admin = await loginAs("director");
    const student = await loginAs("azamat.toirov");
    const reset = await (adminPassword.POST as unknown as Handler)(
      req("POST", "/api/admin/users/usr-stu-01/password", { cookie: admin, body: { newPassword: "reset-by-admin-1" } }),
      { params: Promise.resolve({ id: "usr-stu-01" }) } as never
    );
    expect(reset.status).toBe(200);
    expect((await me.GET(req("GET", "/api/auth/me", { cookie: student }))).status).toBe(401);
    const pending = await loginAs("azamat.toirov", "reset-by-admin-1");
    // after an admin reset the user must choose their own password before using anything else
    const blocked = await call(marks.GET, "GET", "/api/marks", { cookie: pending });
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).code).toBe("PASSWORD_CHANGE_REQUIRED");
    const chosen = await call(password.POST, "POST", "/api/auth/password", { cookie: pending, body: { currentPassword: "reset-by-admin-1", newPassword: "my-own-password-1" } });
    expect(chosen.status).toBe(200);
    const fresh = chosen.headers.get("set-cookie")!.split(";")[0];
    expect((await call(marks.GET, "GET", "/api/marks", { cookie: fresh })).status).toBe(200);
    const asStudent = await (adminPassword.POST as unknown as Handler)(
      req("POST", "/api/admin/users/usr-stu-02/password", { cookie: fresh, body: { newPassword: "hacked-password-1" } }),
      { params: Promise.resolve({ id: "usr-stu-02" }) } as never
    );
    expect(asStudent.status).toBe(403);
  });
});

describe("Students cannot read other students' data", () => {
  beforeAll(setupDb);

  it("marks: own 200, someone else's 403", async () => {
    const cookie = await loginAs("azamat.toirov");
    const own = await call(marks.GET, "GET", "/api/marks", { cookie });
    expect(own.status).toBe(200);
    expect((await own.json()).marks.length).toBeGreaterThan(0);
    expect((await call(marks.GET, "GET", "/api/marks?studentId=usr-stu-01", { cookie })).status).toBe(200);
    expect((await call(marks.GET, "GET", "/api/marks?studentId=usr-stu-02", { cookie })).status).toBe(403);
    expect((await call(marks.GET, "GET", "/api/marks?studentId=usr-stu-03", { cookie })).status).toBe(403);
  });

  it("attendance: own 200, someone else's 403", async () => {
    const cookie = await loginAs("azamat.toirov");
    expect((await call(attendanceRoute.GET, "GET", "/api/attendance?studentId=usr-stu-01", { cookie })).status).toBe(200);
    expect((await call(attendanceRoute.GET, "GET", "/api/attendance?studentId=usr-stu-02", { cookie })).status).toBe(403);
    // a student cannot read a whole lesson's register either
    expect((await call(attendanceRoute.GET, "GET", "/api/attendance?slotId=slot-01&date=2026-10-16", { cookie })).status).toBe(403);
  });

  it("teachers only see students of classes they teach, and subject teachers only their own marks", async () => {
    const physics = await loginAs("bobur.alimov");
    const res = await call(marks.GET, "GET", "/api/marks?studentId=usr-stu-01", { cookie: physics });
    expect(res.status).toBe(200);
    const list = (await res.json()).marks as { subjectName: string }[];
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((m) => m.subjectName === "Fizika va Mexanika")).toBe(true);

    const classTeacher = await loginAs("jasur.rahimov"); // class teacher of 10-A, also teaches math
    const all = (await (await call(marks.GET, "GET", "/api/marks?studentId=usr-stu-01", { cookie: classTeacher })).json()).marks;
    expect(all.length).toBeGreaterThan(list.length);

    // usr-stu-03 is in 9-B, which none of the teachers teach
    expect((await call(marks.GET, "GET", "/api/marks?studentId=usr-stu-03", { cookie: physics })).status).toBe(403);
  });

  it("admins may read any student", async () => {
    const cookie = await loginAs("director");
    expect((await call(marks.GET, "GET", "/api/marks?studentId=usr-stu-03", { cookie })).status).toBe(200);
  });
});

describe("Teachers can only write for classes/subjects they teach", () => {
  beforeAll(setupDb);
  beforeEach(resetDb);

  const record = (slotId: string, studentId = "usr-stu-01") => ({
    records: [{ slotId, studentId, date: "2026-10-17", status: "absent" }],
  });

  it("attendance: own slot OK, another teacher's slot 403 and nothing is written", async () => {
    const english = await loginAs("malika.usmanova"); // teaches English only
    const denied = await call(attendanceRoute.POST, "POST", "/api/attendance", { cookie: english, body: record("slot-01") });
    expect(denied.status).toBe(403);
    expect(await getDb().select().from(attendance).where(eq(attendance.date, "2026-10-17"))).toHaveLength(0);

    const math = await loginAs("jasur.rahimov");
    expect((await call(attendanceRoute.POST, "POST", "/api/attendance", { cookie: math, body: record("slot-01") })).status).toBe(200);
    // slot-02 is physics (Bobur)
    expect((await call(attendanceRoute.POST, "POST", "/api/attendance", { cookie: math, body: record("slot-02") })).status).toBe(403);
  });

  it("attendance: a mixed batch is rejected as a whole", async () => {
    const math = await loginAs("jasur.rahimov");
    const res = await call(attendanceRoute.POST, "POST", "/api/attendance", {
      cookie: math,
      body: { records: [...record("slot-01").records, ...record("slot-02").records] },
    });
    expect(res.status).toBe(403);
    expect(await getDb().select().from(attendance).where(eq(attendance.date, "2026-10-17"))).toHaveLength(0);
  });

  it("attendance: records the logged-in teacher, ignores spoofed fields, and rejects students from other classes", async () => {
    const math = await loginAs("jasur.rahimov");
    const body = { records: [{ slotId: "slot-01", studentId: "usr-stu-01", date: "2026-10-17", status: "late", recordedBy: "usr-tch-03" }] };
    expect((await call(attendanceRoute.POST, "POST", "/api/attendance", { cookie: math, body })).status).toBe(200);
    const [row] = await getDb().select().from(attendance).where(eq(attendance.date, "2026-10-17"));
    expect(row.recordedBy).toBe("usr-tch-01");
    // usr-stu-03 is in class 9-B, not the class taught in slot-01
    expect((await call(attendanceRoute.POST, "POST", "/api/attendance", { cookie: math, body: record("slot-01", "usr-stu-03") })).status).toBe(400);
  });

  it("students and parents cannot write attendance", async () => {
    const student = await loginAs("azamat.toirov");
    expect((await call(attendanceRoute.POST, "POST", "/api/attendance", { cookie: student, body: record("slot-01") })).status).toBe(403);
  });

  it("grading: only the teacher of that assignment's class+subject; the change is audited", async () => {
    const english = await loginAs("malika.usmanova");
    const body = { submissionId: "sub-01", grade: 10, feedback: "x" };
    expect((await call(gradeRoute.POST, "POST", "/api/assignments/grade", { cookie: english, body })).status).toBe(403);
    expect((await db.getSubmissionById("sub-01"))!.grade).toBe(95);

    const math = await loginAs("jasur.rahimov");
    expect((await call(gradeRoute.POST, "POST", "/api/assignments/grade", { cookie: math, body: { ...body, grade: 101 } })).status).toBe(400);
    expect((await call(gradeRoute.POST, "POST", "/api/assignments/grade", { cookie: math, body })).status).toBe(200);
    expect((await db.getSubmissionById("sub-01"))!.grade).toBe(10);
    const audit = await getDb().select().from(auditLog).where(eq(auditLog.entityId, "sub-01"));
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ userId: "usr-tch-01", action: "submission.grade" });

    const student = await loginAs("azamat.toirov");
    expect((await call(gradeRoute.POST, "POST", "/api/assignments/grade", { cookie: student, body })).status).toBe(403);
  });

  it("creating an assignment requires teaching that course", async () => {
    const math = await loginAs("jasur.rahimov");
    const payload = (courseId: string) => ({ courseId, title: "T", instructions: "I", dueDate: "2026-11-01T10:00:00" });
    expect((await call(assignmentsRoute.POST, "POST", "/api/assignments", { cookie: math, body: payload("crs-10a-phys") })).status).toBe(403);
    expect((await call(assignmentsRoute.POST, "POST", "/api/assignments", { cookie: math, body: payload("crs-10a-math") })).status).toBe(201);
  });

  it("assignment lists are scoped by the session, not by query params", async () => {
    const student = await loginAs("temur.bekmirzayev"); // class 9-B has no assignments
    const res = await call(assignmentsRoute.GET, "GET", "/api/assignments?gradeLevel=10&section=A", { cookie: student });
    expect((await res.json()).assignments).toHaveLength(0);
    const other = await loginAs("azamat.toirov");
    const own = await call(assignmentsRoute.GET, "GET", "/api/assignments?teacherId=nobody", { cookie: other });
    expect((await own.json()).assignments.length).toBeGreaterThan(0);
  });

  it("submissions are always attributed to the logged-in student", async () => {
    const madina = await loginAs("madina.zaripova");
    const res = await call(submitRoute.POST, "POST", "/api/assignments/submit", {
      cookie: madina, body: { assignmentId: "asg-02", studentId: "usr-stu-01", content: "my work" },
    });
    expect(res.status).toBe(201);
    expect((await db.getStudentSubmission("asg-02", "usr-stu-02"))?.content).toBe("my work");
    expect(await db.getStudentSubmission("asg-02", "usr-stu-01")).toBeNull();
    const temur = await loginAs("temur.bekmirzayev"); // wrong class
    expect((await call(submitRoute.POST, "POST", "/api/assignments/submit", { cookie: temur, body: { assignmentId: "asg-02", content: "x" } })).status).toBe(403);
  });
});

describe("Submissions and user list are scoped", () => {
  beforeAll(setupDb);

  it("a student reads only their own submission; only the assignment's teacher reads all", async () => {
    const own = await call(submitGet.GET, "GET", "/api/assignments/submit?assignmentId=asg-01", { cookie: await loginAs("azamat.toirov") });
    expect((await own.json()).submissions.map((s: { studentId: string }) => s.studentId)).toEqual(["usr-stu-01"]);
    const other = await call(submitGet.GET, "GET", "/api/assignments/submit?assignmentId=asg-01", { cookie: await loginAs("madina.zaripova") });
    expect((await other.json()).submissions).toEqual([]);
    const outsider = await call(submitGet.GET, "GET", "/api/assignments/submit?assignmentId=asg-01", { cookie: await loginAs("temur.bekmirzayev") });
    expect(outsider.status).toBe(403);
    expect((await call(submitGet.GET, "GET", "/api/assignments/submit?assignmentId=asg-01", { cookie: await loginAs("malika.usmanova") })).status).toBe(403);
    const math = await call(submitGet.GET, "GET", "/api/assignments/submit?assignmentId=asg-01", { cookie: await loginAs("jasur.rahimov") });
    expect(math.status).toBe(200);
  });

  it("only admins can list users, and password hashes are never returned", async () => {
    expect((await call(adminUsers.GET, "GET", "/api/admin/users", { cookie: await loginAs("jasur.rahimov") })).status).toBe(403);
    const res = await call(adminUsers.GET, "GET", "/api/admin/users", { cookie: await loginAs("director") });
    expect(res.status).toBe(200);
    expect(JSON.stringify(await res.json())).not.toMatch(/passwordHash|\$2[aby]\$/);
  });
});

describe("Role gates, DEMO_MODE and FEATURES", () => {
  beforeAll(setupDb);
  const saved = { demo: process.env.DEMO_MODE, features: process.env.FEATURES };
  afterEach(() => {
    process.env.DEMO_MODE = saved.demo;
    process.env.FEATURES = saved.features;
  });

  it("ignores a role claimed in the request; only the session counts", async () => {
    const student = await loginAs("azamat.toirov");
    expect((await call(reviewRoute.GET, "GET", "/api/suggestions/review?role=director", { cookie: student })).status).toBe(403);
    const csv = { callerRole: "manager", entityType: "students", csvContent: "a\nb" };
    expect((await call(csvRoute.POST, "POST", "/api/import/csv", { cookie: student, body: csv })).status).toBe(403);
    const teacher = await loginAs("jasur.rahimov");
    expect((await call(csvRoute.POST, "POST", "/api/import/csv", { cookie: teacher, body: csv })).status).toBe(403);
    const admin = await loginAs("manager");
    expect((await call(reviewRoute.GET, "GET", "/api/suggestions/review", { cookie: admin })).status).toBe(200);
  });

  it("non-admins cannot change ticket status", async () => {
    const teacher = await loginAs("jasur.rahimov");
    expect((await call(ticketsRoute.PATCH, "PATCH", "/api/tickets", { cookie: teacher, body: { id: "tkt-01", status: "resolved" } })).status).toBe(403);
  });

  it("demo reset and demo login do not exist unless DEMO_MODE=true", async () => {
    const admin = await loginAs("director");
    process.env.DEMO_MODE = "false";
    expect((await call(resetRoute.POST, "POST", "/api/demo/reset", { cookie: admin })).status).toBe(404);
    expect((await call(demoLogin.POST, "POST", "/api/auth/demo-login", { body: { role: "admin" } })).status).toBe(404);
    process.env.DEMO_MODE = "true";
    // parent sessions need FEATURES to include "guardian", also through the demo login
    process.env.FEATURES = "";
    expect((await call(demoLogin.POST, "POST", "/api/auth/demo-login", { body: { role: "parent" } })).status).toBe(403);
    process.env.FEATURES = "all";
    const student = await loginAs("azamat.toirov");
    expect((await call(resetRoute.POST, "POST", "/api/demo/reset", { cookie: student })).status).toBe(403);
    const demo = await call(demoLogin.POST, "POST", "/api/auth/demo-login", { body: { role: "teacher" } });
    expect(demo.status).toBe(200);
    expect((await me.GET(req("GET", "/api/auth/me", { cookie: demo.headers.get("set-cookie")!.split(";")[0] }))).status).toBe(200);
  });

  it("out-of-scope modules return 404 when their feature is off", async () => {
    const admin = await loginAs("director");
    process.env.FEATURES = "";
    expect((await call(reviewRoute.GET, "GET", "/api/suggestions/review", { cookie: admin })).status).toBe(404);
    expect((await call(ticketsRoute.GET, "GET", "/api/tickets", { cookie: admin })).status).toBe(404);
    const body = await (await me.GET(req("GET", "/api/auth/me", { cookie: admin }))).json();
    expect(body.features).toEqual([]);
  });
});

describe("Fail closed on missing configuration", () => {
  const keys = ["DATABASE_URL", "SESSION_SECRET", "ANONYMOUS_PEPPER"] as const;
  for (const key of keys) {
    it(`refuses to start without ${key}`, () => {
      const saved = process.env[key];
      delete process.env[key];
      try {
        expect(() => assertEnv()).toThrow(ConfigError);
      } finally {
        process.env[key] = saved;
      }
    });
  }

  it("rejects a short SESSION_SECRET", () => {
    const saved = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "short";
    try {
      expect(() => assertEnv()).toThrow(ConfigError);
    } finally {
      process.env.SESSION_SECRET = saved;
    }
  });
});
