import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import fs from "fs";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { attendance, auditLog, homework } from "@/db/schema";
import { readUpload, uploadDir } from "@/lib/uploads";
import { addDays, earliestEditableDate, isValidDate, schoolDate } from "@/lib/dates";
import { setupDb, resetDb } from "./helpers";
import * as login from "@/app/api/auth/login/route";
import * as attendanceRoute from "@/app/api/attendance/route";
import * as register from "@/app/api/attendance/register/route";
import * as approvals from "@/app/api/attendance/approvals/route";
import * as summary from "@/app/api/attendance/summary/route";
import * as classesRoute from "@/app/api/classes/route";
import * as hwRoute from "@/app/api/homework/route";
import * as hwItem from "@/app/api/homework/[id]/route";
import * as hwFile from "@/app/api/homework/[id]/attachment/route";
import * as hwDone from "@/app/api/homework/[id]/done/route";

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

function call(h: unknown, method: string, path: string, cookie: string, body?: unknown, id = "x") {
  const isForm = body instanceof FormData;
  return (h as Handler)(
    new Request(`http://localhost${path}`, {
      method,
      headers: { cookie, ...(isForm ? {} : { "content-type": "application/json" }) },
      body: body === undefined || method === "GET" ? undefined : isForm ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) } as never
  );
}

const mark = (cookie: string, slotId: string, date: string, studentId = "usr-stu-01", status = "absent") =>
  call(attendanceRoute.POST, "POST", "/api/attendance", cookie, { records: [{ slotId, studentId, date, status }] });

const rows = (date: string) => getDb().select().from(attendance).where(eq(attendance.date, date));

describe("date helpers (school time = Asia/Tashkent)", () => {
  it("uses Tashkent's calendar day, not UTC's", () => {
    expect(schoolDate(new Date("2026-10-17T20:00:00Z"))).toBe("2026-10-18"); // 01:00 in Tashkent
    expect(schoolDate(new Date("2026-10-18T18:59:00Z"))).toBe("2026-10-18");
    expect(schoolDate(new Date("2026-10-18T19:00:00Z"))).toBe("2026-10-19");
  });
  it("computes the 7-day window and validates dates", () => {
    expect(earliestEditableDate(new Date("2026-10-18T07:00:00Z"))).toBe("2026-10-11");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2026-2-3")).toBe(false);
    expect(isValidDate("2026-10-18")).toBe(true);
  });
});

describe("M3: attendance backdate window", () => {
  beforeAll(setupDb);
  beforeEach(async () => { await resetDb(); vi.setSystemTime(new Date("2026-10-18T07:00:00Z")); });

  it("teachers can record today and up to 7 days back, not older, not the future", async () => {
    const math = await loginAs("jasur.rahimov");
    expect((await mark(math, "slot-01", "2026-10-18")).status).toBe(200);
    expect((await mark(math, "slot-01", "2026-10-11")).status).toBe(200); // exactly 7 days
    const old = await mark(math, "slot-01", "2026-10-10"); // 8 days
    expect(old.status).toBe(403);
    expect((await old.json()).error).toMatch(/administrator/i);
    expect(await rows("2026-10-10")).toHaveLength(0);
    expect((await mark(math, "slot-01", "2026-10-19")).status).toBe(400);
    expect(await rows("2026-10-19")).toHaveLength(0);
  });

  it("a batch with one too-old lesson is rejected as a whole", async () => {
    const math = await loginAs("jasur.rahimov");
    const res = await call(attendanceRoute.POST, "POST", "/api/attendance", math, { records: [
      { slotId: "slot-01", studentId: "usr-stu-01", date: "2026-10-17", status: "absent" },
      { slotId: "slot-01", studentId: "usr-stu-02", date: "2026-09-01", status: "absent" },
    ] });
    expect(res.status).toBe(403);
    expect(await rows("2026-10-17")).toHaveLength(0);
  });

  it("uses Tashkent time at the day boundary", async () => {
    vi.setSystemTime(new Date("2026-10-17T20:00:00Z")); // already Oct 18 in Tashkent
    const math = await loginAs("jasur.rahimov");
    expect((await mark(math, "slot-01", "2026-10-18")).status).toBe(200);
    expect((await mark(math, "slot-01", "2026-10-19")).status).toBe(400);
  });

  it("an admin approval unlocks exactly that lesson (slot + date), for teachers of that slot", async () => {
    const math = await loginAs("jasur.rahimov");
    const admin = await loginAs("director");
    expect((await call(approvals.POST, "POST", "/api/attendance/approvals", math, { slotId: "slot-01", date: "2026-10-01" })).status).toBe(403);
    expect((await call(approvals.POST, "POST", "/api/attendance/approvals", await loginAs("azamat.toirov"), { slotId: "slot-01", date: "2026-10-01" })).status).toBe(403);
    expect((await call(approvals.POST, "POST", "/api/attendance/approvals", admin, { slotId: "nope", date: "2026-10-01" })).status).toBe(404);
    expect((await call(approvals.POST, "POST", "/api/attendance/approvals", admin, { slotId: "slot-01", date: "2027-01-01" })).status).toBe(400);

    const ok = await call(approvals.POST, "POST", "/api/attendance/approvals", admin, { slotId: "slot-01", date: "2026-10-01", reason: "sick leave paperwork" });
    expect(ok.status).toBe(201);
    expect((await mark(math, "slot-01", "2026-10-01")).status).toBe(200);
    expect((await mark(math, "slot-01", "2026-10-02")).status).toBe(403); // other date
    expect((await mark(await loginAs("bobur.alimov"), "slot-02", "2026-10-01")).status).toBe(403); // other slot
    expect((await mark(await loginAs("malika.usmanova"), "slot-01", "2026-10-01")).status).toBe(403); // not their slot
    const audit = await getDb().select().from(auditLog).where(eq(auditLog.action, "attendance.backdate_approve"));
    expect(audit).toHaveLength(1);
    expect(audit[0].userId).toBe("usr-dir-01");
    expect((await call(approvals.GET, "GET", "/api/attendance/approvals", admin)).status).toBe(200);
    expect((await call(approvals.GET, "GET", "/api/attendance/approvals", math)).status).toBe(403);
  });

  it("admins can edit old lessons without an approval but still not the future", async () => {
    const admin = await loginAs("director");
    expect((await mark(admin, "slot-01", "2026-09-01")).status).toBe(200);
    expect((await mark(admin, "slot-01", "2026-11-01")).status).toBe(400);
  });
});

describe("M3: attendance register and class summary", () => {
  beforeAll(setupDb);
  beforeEach(async () => { await resetDb(); vi.setSystemTime(new Date("2026-10-18T07:00:00Z")); });

  it("the register lists the whole class (unrecorded = null) and says if the date is editable", async () => {
    const math = await loginAs("jasur.rahimov");
    const res = await call(register.GET, "GET", "/api/attendance/register?slotId=slot-01&date=2026-10-16", math);
    const body = await res.json();
    expect(body.students.map((s: { studentId: string; status: string | null }) => [s.studentId, s.status])).toEqual([
      ["usr-stu-01", "present"], ["usr-stu-02", "present"],
    ]);
    expect(body.editability.editable).toBe(true);
    const fresh = await (await call(register.GET, "GET", "/api/attendance/register?slotId=slot-01&date=2026-10-17", math)).json();
    expect(fresh.students.every((s: { status: string | null }) => s.status === null)).toBe(true);
    const old = await (await call(register.GET, "GET", "/api/attendance/register?slotId=slot-01&date=2026-09-01", math)).json();
    expect(old.editability).toMatchObject({ editable: false, reason: "needs_approval" });
  });

  it("the register is only for the teacher of that lesson (or an admin)", async () => {
    const path = "/api/attendance/register?slotId=slot-01&date=2026-10-16";
    expect((await call(register.GET, "GET", path, await loginAs("malika.usmanova"))).status).toBe(403);
    expect((await call(register.GET, "GET", path, await loginAs("azamat.toirov"))).status).toBe(403);
    expect((await call(register.GET, "GET", path, await loginAs("director"))).status).toBe(200);
    expect((await call(register.GET, "GET", "/api/attendance/register?slotId=slot-01&date=nope", await loginAs("director"))).status).toBe(400);
  });

  it("only the class teacher (or admin) sees the whole-class summary, with correct counts", async () => {
    const classTeacher = await loginAs("jasur.rahimov"); // class teacher of 10-A
    await mark(classTeacher, "slot-01", "2026-10-17", "usr-stu-02", "absent");
    await mark(classTeacher, "slot-01", "2026-10-17", "usr-stu-01", "excused");
    const res = await call(summary.GET, "GET", "/api/attendance/summary?classId=cls-10a&from=2026-10-01&to=2026-10-18", classTeacher);
    expect(res.status).toBe(200);
    const byId = Object.fromEntries((await res.json()).students.map((s: { studentId: string }) => [s.studentId, s]));
    // seed: 2026-10-16 stu-01 present(slot-01) + late(slot-02); stu-02 present(slot-01)
    expect(byId["usr-stu-01"]).toMatchObject({ present: 1, late: 1, excused: 1, absent: 0, rate: 100 });
    expect(byId["usr-stu-02"]).toMatchObject({ present: 1, absent: 1, rate: 50 });

    const physics = await loginAs("bobur.alimov"); // teaches 10-A but is not its class teacher
    expect((await call(summary.GET, "GET", "/api/attendance/summary?classId=cls-10a", physics)).status).toBe(403);
    expect((await call(summary.GET, "GET", "/api/attendance/summary?classId=cls-10a", await loginAs("azamat.toirov"))).status).toBe(403);
    expect((await call(summary.GET, "GET", "/api/attendance/summary?classId=cls-10a", await loginAs("director"))).status).toBe(200);
    expect((await call(summary.GET, "GET", "/api/attendance/summary?classId=cls-10a&from=2026-10-18&to=2026-10-01", classTeacher)).status).toBe(400);
  });

  it("class lists: a teacher sees only the classes they are class teacher of", async () => {
    const mine = (await (await call(classesRoute.GET, "GET", "/api/classes", await loginAs("jasur.rahimov"))).json()).classes;
    expect(mine.map((c: { id: string }) => c.id)).toEqual(["cls-10a"]);
    expect((await (await call(classesRoute.GET, "GET", "/api/classes", await loginAs("bobur.alimov"))).json()).classes).toEqual([]);
  });
});

// A tiny but real PDF header + padding is enough for the magic-byte check.
const pdf = (size = 200) => new File([Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(size, 0x20)])], "worksheet 1.pdf", { type: "application/pdf" });

function hwForm(fields: Record<string, string>, file?: File) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  if (file) f.set("file", file);
  return f;
}
const post = (cookie: string, fields: Record<string, string>, file?: File) =>
  call(hwRoute.POST, "POST", "/api/homework", cookie, hwForm({ courseId: "crs-10a-math", description: "Ex. 1-5", dueDate: "2026-10-20", ...fields }, file));

describe("M3: homework", () => {
  beforeAll(setupDb);
  beforeEach(async () => { fs.rmSync(uploadDir(), { recursive: true, force: true }); await resetDb(); vi.setSystemTime(new Date("2026-10-18T07:00:00Z")); });
  afterAll(() => fs.rmSync(uploadDir(), { recursive: true, force: true }));

  it("a teacher posts homework with an attachment; the right people can download it", async () => {
    const math = await loginAs("jasur.rahimov");
    const res = await post(math, {}, pdf());
    expect(res.status).toBe(201);
    const hw = (await res.json()).homework;
    expect(hw).toMatchObject({ hasAttachment: true, attachmentName: "worksheet 1.pdf", className: "10-A" });
    expect(hw.attachmentFile).toBeUndefined(); // storage name is never exposed

    const path = `/api/homework/${hw.id}/attachment`;
    const ok = await call(hwFile.GET, "GET", path, await loginAs("azamat.toirov"), undefined, hw.id);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("application/pdf");
    expect(ok.headers.get("content-disposition")).toContain("worksheet 1.pdf");
    expect(ok.headers.get("x-content-type-options")).toBe("nosniff");
    expect((await ok.arrayBuffer()).byteLength).toBe(9 + 200);

    expect((await call(hwFile.GET, "GET", path, await loginAs("temur.bekmirzayev"), undefined, hw.id)).status).toBe(403); // other class
    expect((await call(hwFile.GET, "GET", path, await loginAs("malika.usmanova"), undefined, hw.id)).status).toBe(403); // other teacher
    expect((await call(hwFile.GET, "GET", path, await loginAs("director"), undefined, hw.id)).status).toBe(200);
    expect((await call(hwFile.GET, "GET", path, math, undefined, hw.id)).status).toBe(200);
  });

  it("rejects bad uploads and bad input, and stores nothing", async () => {
    const math = await loginAs("jasur.rahimov");
    const exe = new File([Buffer.from("MZ....")], "virus.exe");
    expect((await post(math, {}, exe)).status).toBe(400);
    const fake = new File([Buffer.from("just text, not a pdf")], "fake.pdf");
    expect((await post(math, {}, fake)).status).toBe(400);
    const huge = new File([Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(5 * 1024 * 1024)])], "huge.pdf");
    expect((await post(math, {}, huge)).status).toBe(413);
    expect((await post(math, { dueDate: "2026-10-17" })).status).toBe(400); // yesterday
    expect((await post(math, { dueDate: "20-10-2026" })).status).toBe(400);
    expect((await post(math, { description: "  " })).status).toBe(400);
    expect(await getDb().select().from(homework)).toHaveLength(0);
    expect(fs.existsSync(uploadDir()) ? fs.readdirSync(uploadDir()) : []).toHaveLength(0);
  });

  it("only the teacher of the course (or admin) posts; students cannot", async () => {
    expect((await post(await loginAs("malika.usmanova"), {})).status).toBe(403);
    expect((await post(await loginAs("azamat.toirov"), {})).status).toBe(403);
    expect((await post(await loginAs("director"), {})).status).toBe(201);
  });

  it("students see today's homework first, then upcoming; past is hidden unless asked for", async () => {
    const math = await loginAs("jasur.rahimov");
    await post(math, { description: "later", dueDate: "2026-10-25" });
    await post(math, { description: "today", dueDate: "2026-10-18" });
    await post(math, { description: "soon", dueDate: "2026-10-20" });
    await getDb().insert(homework).values({ teacherAssignmentId: "crs-10a-math", description: "old", dueDate: "2026-10-10", postedBy: "usr-tch-01" });

    const student = await loginAs("azamat.toirov");
    const list = (await (await call(hwRoute.GET, "GET", "/api/homework", student)).json()).homework;
    expect(list.map((h: { description: string }) => h.description)).toEqual(["today", "soon", "later"]);
    const all = (await (await call(hwRoute.GET, "GET", "/api/homework?all=1", student)).json()).homework;
    expect(all.map((h: { description: string }) => h.description)).toEqual(["old", "today", "soon", "later"]);
    // another class sees none of it
    const other = (await (await call(hwRoute.GET, "GET", "/api/homework", await loginAs("temur.bekmirzayev"))).json()).homework;
    expect(other).toEqual([]);
    // a teacher only sees what they teach
    const eng = (await (await call(hwRoute.GET, "GET", "/api/homework", await loginAs("malika.usmanova"))).json()).homework;
    expect(eng).toEqual([]);
  });

  it("students mark their own homework done and undone; others can't", async () => {
    const math = await loginAs("jasur.rahimov");
    const { homework: hw } = await (await post(math, {})).json();
    const azamat = await loginAs("azamat.toirov");
    expect((await call(hwDone.POST, "POST", `/api/homework/${hw.id}/done`, azamat, { done: true }, hw.id)).status).toBe(200);
    const done = (id: string, c: string) => call(hwRoute.GET, "GET", "/api/homework", c).then((r) => r.json()).then((d) => d.homework.find((h: { id: string }) => h.id === id).done);
    expect(await done(hw.id, azamat)).toBe(true);
    expect(await done(hw.id, await loginAs("madina.zaripova"))).toBe(false); // per student
    expect((await call(hwDone.POST, "POST", `/api/homework/${hw.id}/done`, azamat, { done: false }, hw.id)).status).toBe(200);
    expect(await done(hw.id, azamat)).toBe(false);
    expect((await call(hwDone.POST, "POST", `/api/homework/${hw.id}/done`, await loginAs("temur.bekmirzayev"), { done: true }, hw.id)).status).toBe(403);
    expect((await call(hwDone.POST, "POST", `/api/homework/${hw.id}/done`, math, { done: true }, hw.id)).status).toBe(403);
  });

  it("deleting removes the row and the file; only the owner teacher or admin may", async () => {
    const math = await loginAs("jasur.rahimov");
    const { homework: hw } = await (await post(math, {}, pdf())).json();
    expect(fs.readdirSync(uploadDir())).toHaveLength(1);
    expect((await call(hwItem.DELETE, "DELETE", `/api/homework/${hw.id}`, await loginAs("malika.usmanova"), undefined, hw.id)).status).toBe(403);
    expect((await call(hwItem.DELETE, "DELETE", `/api/homework/${hw.id}`, await loginAs("azamat.toirov"), undefined, hw.id)).status).toBe(403);
    expect((await call(hwItem.DELETE, "DELETE", `/api/homework/${hw.id}`, math, undefined, hw.id)).status).toBe(200);
    expect(await getDb().select().from(homework)).toHaveLength(0);
    expect(fs.readdirSync(uploadDir())).toHaveLength(0);
    expect((await call(hwItem.DELETE, "DELETE", `/api/homework/${hw.id}`, math, undefined, hw.id)).status).toBe(404);
  });

  it("a tampered stored file name can never read outside the upload folder", async () => {
    for (const bad of ["../../etc/passwd", "/etc/passwd", "..%2f..%2fx.pdf", "a.pdf"]) {
      await expect(readUpload(bad)).rejects.toMatchObject({ status: 404 });
    }
  });
});
