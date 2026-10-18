import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { db } from "@/db";
import { createUser } from "@/db/admin";
import { setupDb, resetDb } from "./helpers";
import { buildTranscript } from "@/lib/transcript";
import { DEFAULT_SCALE } from "@/lib/grading";
import { hashPassword } from "@/lib/auth";
import * as login from "@/app/api/auth/login/route";
import * as transcriptRoute from "@/app/api/transcripts/[studentId]/route";
import * as pdfRoute from "@/app/api/transcripts/[studentId]/pdf/route";
import * as classStudents from "@/app/api/classes/[id]/students/route";
import * as settingsRoute from "@/app/api/admin/settings/route";

type Handler = (req: Request, ctx: never) => Promise<Response>;

async function loginAs(username: string) {
  const res = await login.POST(new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password: "Demo123!" }) }));
  expect(res.status).toBe(200);
  return res.headers.get("set-cookie")!.split(";")[0];
}
const call = (h: unknown, path: string, cookie: string, id: string, method = "GET", body?: unknown) =>
  (h as Handler)(new Request(`http://localhost${path}`, { method, headers: { cookie, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }),
    { params: Promise.resolve({ studentId: id, id }) } as never);

const hasPdftotext = spawnSync("pdftotext", ["-v"]).status !== null && spawnSync("pdftotext", ["-v"]).error === undefined;
const pdfText = (bytes: Uint8Array) => {
  const f = path.join(os.tmpdir(), `t-${process.pid}-${Math.random().toString(36).slice(2)}.pdf`);
  fs.writeFileSync(f, bytes);
  try { return execFileSync("pdftotext", ["-layout", f, "-"], { encoding: "utf8" }); } finally { fs.rmSync(f, { force: true }); }
};

describe("buildTranscript (pure)", () => {
  const m = (subjectId: string, termId: string, score: number, maxScore: number, start = termId) =>
    ({ subjectId, subjectName: subjectId, teacherName: "T " + subjectId, termId, termName: termId, termStart: start, score, maxScore });

  it("averages per term, then across terms, and maps to the 5-point scale", () => {
    const t = buildTranscript([m("math", "t1", 18, 20, "2026-09"), m("math", "t1", 91, 100, "2026-09"), m("math", "t2", 80, 100, "2027-01"), m("phys", "t1", 9, 10, "2026-09")], DEFAULT_SCALE);
    expect(t.terms.map((x) => x.id)).toEqual(["t1", "t2"]);
    const math = t.subjects.find((s) => s.subjectId === "math")!;
    expect(math.terms.t1).toEqual({ average: 90.8, grade: 5 });
    expect(math.terms.t2).toEqual({ average: 80, grade: 4 });
    expect(math.periodAverage).toBe(85.4);
    expect(math.periodGrade).toBe(4);
    expect(t.overall.terms).toEqual({ t1: 90.4, t2: 80 });
    expect(t.overall.period).toBe(87.7); // mean of subject period averages (85.4 and 90)
    expect(t.overall.grade).toBe(5);
  });

  it("one term only, empty input, and percent mode", () => {
    const rows = [m("math", "t1", 50, 100, "a"), m("math", "t2", 100, 100, "b")];
    expect(buildTranscript(rows, DEFAULT_SCALE, "t2").subjects[0]).toMatchObject({ periodAverage: 100, periodGrade: 5 });
    expect(buildTranscript([], DEFAULT_SCALE)).toMatchObject({ subjects: [], terms: [], overall: { period: null, grade: null } });
    expect(buildTranscript(rows, { mode: "percent" }).subjects[0].periodGrade).toBe(75);
  });
});

describe("M4: transcript API access", () => {
  beforeAll(setupDb);
  beforeEach(resetDb);

  it("returns the right numbers for a student's own transcript", async () => {
    const cookie = await loginAs("azamat.toirov");
    const res = await call(transcriptRoute.GET, "/api/transcripts/usr-stu-01", cookie, "usr-stu-01");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.student).toMatchObject({ fullName: "Azamat Toirov", className: "10-A" });
    const math = body.transcript.subjects.find((s: { subjectId: string }) => s.subjectId === "sbj-math");
    expect(math).toMatchObject({ teacherName: "Jasur Rahimov", periodAverage: 90.8, periodGrade: 5 });
    expect(body.transcript.overall.period).toBe(90.4);
    expect((await call(transcriptRoute.GET, "/api/transcripts/usr-stu-01?termId=term-2026-2", cookie, "usr-stu-01").then((r) => r.json())).transcript.subjects).toEqual([]);
    expect((await call(transcriptRoute.GET, "/api/transcripts/usr-stu-01?termId=nope", cookie, "usr-stu-01")).status).toBe(400);
  });

  it("follows the school's grading scale setting", async () => {
    const admin = await loginAs("director");
    await call(settingsRoute.PUT, "/api/admin/settings", admin, "x", "PUT", { gradingScale: { mode: "percent" } });
    const body = await (await call(transcriptRoute.GET, "/api/transcripts/usr-stu-01", await loginAs("azamat.toirov"), "usr-stu-01")).json();
    expect(body.scale).toEqual({ mode: "percent" });
    expect(body.transcript.subjects.find((s: { subjectId: string }) => s.subjectId === "sbj-math").periodGrade).toBe(91);
  });

  it("only the student, their class teacher, admins and linked parents may see it", async () => {
    const path = "/api/transcripts/usr-stu-01";
    const get = async (who: string, id = "usr-stu-01") => (await call(transcriptRoute.GET, `/api/transcripts/${id}`, await loginAs(who), id)).status;
    expect(await get("azamat.toirov")).toBe(200);
    expect(await get("madina.zaripova")).toBe(403);
    expect(await get("jasur.rahimov")).toBe(200); // class teacher of 10-A
    expect(await get("bobur.alimov")).toBe(403);   // teaches Azamat physics but is not the class teacher
    expect(await get("malika.usmanova")).toBe(403);
    expect(await get("director")).toBe(200);
    expect(await get("farhod.toirov")).toBe(200);  // linked parent (guardian feature is on in tests)
    expect(await get("farhod.toirov", "usr-stu-02")).toBe(403);
    expect(await get("director", "usr-tch-01")).toBe(404); // not a student
    expect(path).toBeTruthy();
  });

  it("class teacher sees the student list of their class only", async () => {
    const mine = await call(classStudents.GET, "/api/classes/cls-10a/students", await loginAs("jasur.rahimov"), "cls-10a");
    expect((await mine.json()).students.map((s: { id: string }) => s.id)).toEqual(["usr-stu-01", "usr-stu-02"]);
    expect((await call(classStudents.GET, "/api/classes/cls-10a/students", await loginAs("bobur.alimov"), "cls-10a")).status).toBe(403);
    expect((await call(classStudents.GET, "/api/classes/cls-10a/students", await loginAs("azamat.toirov"), "cls-10a")).status).toBe(403);
    expect((await call(classStudents.GET, "/api/classes/cls-10a/students", await loginAs("director"), "cls-10a")).status).toBe(200);
  });
});

describe("M4: transcript PDF", () => {
  beforeAll(setupDb);
  beforeEach(resetDb);

  it("renders a PDF for the student; access rules match the JSON route", async () => {
    const res = await call(pdfRoute.GET, "/api/transcripts/usr-stu-01/pdf", await loginAs("azamat.toirov"), "usr-stu-01");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="transcript_Azamat_Toirov_10-A\.pdf"/);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(5000);
    expect((await call(pdfRoute.GET, "/api/transcripts/usr-stu-01/pdf", await loginAs("madina.zaripova"), "usr-stu-01")).status).toBe(403);
    expect((await call(pdfRoute.GET, "/api/transcripts/usr-stu-01/pdf?termId=nope", await loginAs("director"), "usr-stu-01")).status).toBe(400);
  });

  it.skipIf(!hasPdftotext)("contains the student, subjects, teachers, averages and grades (and Uzbek letters)", async () => {
    const pw = await hashPassword("x".repeat(12), 4);
    const u = await createUser({ username: "otkir.g", fullName: "Oʻtkir Gʻaniyev", role: "student", classId: "cls-10a", passwordHash: pw, mustChangePassword: false }, "usr-dir-01");
    const ta = "crs-10a-math";
    const asm = await db.createAssessment({ courseId: ta, termId: "term-2026-1", type: "test", title: "T", date: "2026-10-01", maxScore: 100, actorId: "usr-tch-01" });
    await db.saveMarks(asm.id, [{ studentId: u.id, score: 72 }], "usr-tch-01");

    const res = await call(pdfRoute.GET, `/api/transcripts/${u.id}/pdf?lang=en`, await loginAs("director"), u.id);
    const text = pdfText(new Uint8Array(await res.arrayBuffer()));
    expect(text).toContain("Academic Transcript");
    expect(text).toContain("Oʻtkir Gʻaniyev");
    expect(text).toContain("10-A");
    expect(text).toContain("Kengaytirilgan Matematika");
    expect(text).toContain("Jasur Rahimov");
    expect(text).toMatch(/72(\.0)?%/);
    expect(text).toMatch(/72%\s+4/); // 72% -> grade 4 on the default scale

    const uz = pdfText(new Uint8Array(await (await call(pdfRoute.GET, `/api/transcripts/${u.id}/pdf`, await loginAs("director"), u.id)).arrayBuffer()));
    expect(uz).toContain("Akademik ma'lumotnoma");
  });

  it.skipIf(!hasPdftotext)("a one-term transcript and an empty transcript render", async () => {
    const cookie = await loginAs("azamat.toirov");
    const one = pdfText(new Uint8Array(await (await call(pdfRoute.GET, "/api/transcripts/usr-stu-01/pdf?termId=term-2026-1&lang=en", cookie, "usr-stu-01")).arrayBuffer()));
    expect(one).toContain("Term 1");
    const empty = pdfText(new Uint8Array(await (await call(pdfRoute.GET, "/api/transcripts/usr-stu-01/pdf?termId=term-2026-2&lang=en", cookie, "usr-stu-01")).arrayBuffer()));
    expect(empty).toContain("No marks recorded");
  });
});
