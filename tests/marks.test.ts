import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { getDb } from "@/db/client";
import { academicYears, auditLog, marks, terms } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { summarizeMarks } from "@/lib/marks";
import { setupDb, resetDb } from "./helpers";
import * as login from "@/app/api/auth/login/route";
import * as assessments from "@/app/api/assessments/route";
import * as gridRoute from "@/app/api/assessments/[id]/marks/route";
import * as marksRoute from "@/app/api/marks/route";
import * as termRoute from "@/app/api/terms/[id]/route";
import * as termsRoute from "@/app/api/terms/route";
import * as coursesRoute from "@/app/api/courses/route";

type Handler = (req: Request, ctx: never) => Promise<Response>;

async function loginAs(username: string) {
  const res = await login.POST(
    new Request("http://localhost/api/auth/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password: "Demo123!" }),
    })
  );
  return res.headers.get("set-cookie")!.split(";")[0];
}

const call = (h: unknown, method: string, path: string, cookie: string, body?: unknown, id?: string) =>
  (h as Handler)(
    new Request(`http://localhost${path}`, {
      method, headers: { cookie, "content-type": "application/json" },
      body: body === undefined || method === "GET" ? undefined : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: id ?? "x" }) } as never
  );

const put = (cookie: string, id: string, list: unknown[]) =>
  call(gridRoute.PUT, "PUT", `/api/assessments/${id}/marks`, cookie, { marks: list }, id);

describe("summarizeMarks", () => {
  const m = (subjectId: string, termId: string, score: number, maxScore: number) =>
    ({ subjectId, subjectName: subjectId, termId, termName: termId, score, maxScore });

  it("weights by points and averages subjects equally", () => {
    const [t1] = summarizeMarks([m("math", "t1", 18, 20), m("math", "t1", 80, 100), m("phys", "t1", 5, 10)]);
    expect(t1.subjects.find((s) => s.subjectId === "math")!.average).toBe(81.7); // 98/120
    expect(t1.subjects.find((s) => s.subjectId === "phys")!.average).toBe(50);
    expect(t1.overall).toBe(65.9);
  });

  it("keeps terms apart and handles no marks", () => {
    expect(summarizeMarks([m("a", "t1", 1, 2), m("a", "t2", 2, 2)]).map((t) => t.overall)).toEqual([50, 100]);
    expect(summarizeMarks([])).toEqual([]);
  });
});

describe("M2: assessments and the class grid", () => {
  beforeAll(setupDb);
  beforeEach(resetDb);

  it("lists only the teacher's own courses", async () => {
    const res = await call(coursesRoute.GET, "GET", "/api/courses", await loginAs("bobur.alimov"));
    const list = (await res.json()).courses as { subjectId: string }[];
    expect(list.map((c) => c.subjectId)).toEqual(["sbj-phys"]);
  });

  it("a teacher creates an assessment and enters marks; every change is audited", async () => {
    const cookie = await loginAs("jasur.rahimov");
    const created = await call(assessments.POST, "POST", "/api/assessments", cookie, {
      courseId: "crs-10a-math", termId: "term-2026-1", type: "test", title: "Unit test", date: "2026-10-20", maxScore: 50,
    });
    expect(created.status).toBe(201);
    const { id } = (await created.json()).assessment;

    const grid = await (await call(gridRoute.GET, "GET", `/api/assessments/${id}/marks`, cookie, undefined, id)).json();
    expect(grid.grid.map((r: { studentId: string }) => r.studentId).sort()).toEqual(["usr-stu-01", "usr-stu-02"]);

    expect((await put(cookie, id, [{ studentId: "usr-stu-01", score: 45 }, { studentId: "usr-stu-02", score: 30, comment: "ok" }])).status).toBe(200);
    // same values again -> nothing changes, nothing audited
    const again = await (await put(cookie, id, [{ studentId: "usr-stu-01", score: 45 }])).json();
    expect(again.changed).toBe(0);
    // edit and clear
    expect((await (await put(cookie, id, [{ studentId: "usr-stu-01", score: 40 }, { studentId: "usr-stu-02", score: null }])).json()).changed).toBe(2);

    const rows = await getDb().select().from(marks).where(eq(marks.assessmentId, id));
    expect(rows.map((r) => [r.studentId, r.score, r.updatedBy])).toEqual([["usr-stu-01", 40, "usr-tch-01"]]);
    const audit = await getDb().select().from(auditLog).where(eq(auditLog.entity, "mark"));
    const actions = audit.map((a) => a.action).sort();
    expect(actions).toEqual(["mark.create", "mark.create", "mark.delete", "mark.update"]);
    const update = audit.find((a) => a.action === "mark.update")!;
    expect(update.oldValue).toMatchObject({ score: 45 });
    expect(update.newValue).toMatchObject({ score: 40 });
    expect(update.userId).toBe("usr-tch-01");
  });

  it("rejects out-of-range scores and students from other classes, writing nothing", async () => {
    const cookie = await loginAs("jasur.rahimov");
    const before = await getDb().select().from(marks);
    expect((await put(cookie, "asm-math-q1", [{ studentId: "usr-stu-01", score: 21 }])).status).toBe(400); // max 20
    expect((await put(cookie, "asm-math-q1", [{ studentId: "usr-stu-01", score: -1 }])).status).toBe(400);
    expect((await put(cookie, "asm-math-q1", [{ studentId: "usr-stu-01", score: 1.5 }])).status).toBe(400);
    expect((await put(cookie, "asm-math-q1", [{ studentId: "usr-stu-01", score: 5 }, { studentId: "usr-stu-03", score: 5 }])).status).toBe(400);
    expect(await getDb().select().from(marks)).toHaveLength(before.length);
  });

  it("a teacher cannot read or write another teacher's assessments or create one for their course", async () => {
    const english = await loginAs("malika.usmanova");
    expect((await call(gridRoute.GET, "GET", "/api/assessments/asm-math-q1/marks", english, undefined, "asm-math-q1")).status).toBe(403);
    expect((await put(english, "asm-math-q1", [{ studentId: "usr-stu-01", score: 1 }])).status).toBe(403);
    expect((await call(assessments.POST, "POST", "/api/assessments", english, {
      courseId: "crs-10a-math", termId: "term-2026-1", type: "quiz", title: "x", date: "2026-10-20", maxScore: 10,
    })).status).toBe(403);
    expect((await call(assessments.GET, "GET", "/api/assessments?courseId=crs-10a-math", english)).status).toBe(403);
    const [m] = await getDb().select().from(marks).where(and(eq(marks.assessmentId, "asm-math-q1"), eq(marks.studentId, "usr-stu-01")));
    expect(m.score).toBe(18);
  });

  it("students cannot use the grid or create assessments", async () => {
    const student = await loginAs("azamat.toirov");
    expect((await call(gridRoute.GET, "GET", "/api/assessments/asm-math-q1/marks", student, undefined, "asm-math-q1")).status).toBe(403);
    expect((await put(student, "asm-math-q1", [{ studentId: "usr-stu-01", score: 20 }])).status).toBe(403);
    expect((await call(assessments.POST, "POST", "/api/assessments", student, {})).status).toBe(403);
  });
});

describe("M2: terms belong to the class's academic year", () => {
  beforeAll(setupDb);
  beforeEach(resetDb);

  it("rejects a term from another academic year and filters the term list by course", async () => {
    const db = getDb();
    await db.insert(academicYears).values({ id: "ay-2025", name: "2025-2026", startDate: "2025-09-01", endDate: "2026-06-30" });
    await db.insert(terms).values({ id: "term-2025-1", yearId: "ay-2025", name: "Old Term 1", startDate: "2025-09-01", endDate: "2025-12-27" });
    const teacher = await loginAs("jasur.rahimov");
    const res = await call(assessments.POST, "POST", "/api/assessments", teacher, {
      courseId: "crs-10a-math", termId: "term-2025-1", type: "quiz", title: "wrong year", date: "2026-10-20", maxScore: 10,
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/academic year/);
    const list = await (await call(termsRoute.GET, "GET", "/api/terms?courseId=crs-10a-math", teacher)).json();
    expect(list.terms.map((x: { id: string }) => x.id)).toEqual(["term-2026-1", "term-2026-2"]);
    expect((await (await call(termsRoute.GET, "GET", "/api/terms", teacher)).json()).terms).toHaveLength(3);
  });
});

describe("M2: closed terms", () => {
  beforeAll(setupDb);
  beforeEach(resetDb);

  it("only an admin can close a term", async () => {
    const teacher = await loginAs("jasur.rahimov");
    expect((await call(termRoute.PATCH, "PATCH", "/api/terms/term-2026-1", teacher, { closed: true }, "term-2026-1")).status).toBe(403);
    const admin = await loginAs("director");
    expect((await call(termRoute.PATCH, "PATCH", "/api/terms/term-2026-1", admin, { closed: true }, "term-2026-1")).status).toBe(200);
    expect((await call(termRoute.PATCH, "PATCH", "/api/terms/nope", admin, { closed: true }, "nope")).status).toBe(404);
  });

  it("in a closed term teachers cannot change marks or add assessments, but an admin can (audited)", async () => {
    const admin = await loginAs("director");
    await call(termRoute.PATCH, "PATCH", "/api/terms/term-2026-1", admin, { closed: true }, "term-2026-1");

    const teacher = await loginAs("jasur.rahimov");
    expect((await put(teacher, "asm-math-q1", [{ studentId: "usr-stu-01", score: 20 }])).status).toBe(403);
    expect((await call(assessments.POST, "POST", "/api/assessments", teacher, {
      courseId: "crs-10a-math", termId: "term-2026-1", type: "quiz", title: "late", date: "2026-10-20", maxScore: 10,
    })).status).toBe(403);
    // reading is still fine
    expect((await call(gridRoute.GET, "GET", "/api/assessments/asm-math-q1/marks", teacher, undefined, "asm-math-q1")).status).toBe(200);

    const res = await put(admin, "asm-math-q1", [{ studentId: "usr-stu-01", score: 20 }]);
    expect(res.status).toBe(200);
    const audit = await getDb().select().from(auditLog).where(eq(auditLog.action, "mark.update"));
    expect(audit).toHaveLength(1);
    expect(audit[0].userId).toBe("usr-dir-01");
    expect((await getDb().select().from(auditLog).where(eq(auditLog.action, "term.close"))).length).toBe(1);
  });
});

describe("M2: students see marks and averages", () => {
  beforeAll(setupDb);

  it("returns marks plus per-term subject and overall averages for the student themselves only", async () => {
    const cookie = await loginAs("azamat.toirov");
    const body = await (await call(marksRoute.GET, "GET", "/api/marks", cookie)).json();
    expect(body.marks.length).toBe(3);
    const [term] = body.summary;
    expect(term.termId).toBe("term-2026-1");
    const math = term.subjects.find((s: { subjectId: string }) => s.subjectId === "sbj-math");
    expect(math.average).toBe(90.8); // (18 + 91) / (20 + 100)
    expect(term.subjects.find((s: { subjectId: string }) => s.subjectId === "sbj-phys").average).toBe(90);
    expect(term.overall).toBe(90.4);
    expect((await call(marksRoute.GET, "GET", "/api/marks?studentId=usr-stu-02", cookie)).status).toBe(403);
  });
});
