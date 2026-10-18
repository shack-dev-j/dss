"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/i18n/context";

const STATUSES = ["present", "absent", "late", "excused"] as const;
type Status = (typeof STATUSES)[number];
const STATUS_STYLE: Record<Status, string> = {
  present: "bg-emerald-600 text-white border-emerald-600",
  absent: "bg-rose-600 text-white border-rose-600",
  late: "bg-amber-500 text-white border-amber-500",
  excused: "bg-sky-600 text-white border-sky-600",
};
const inputCls = "px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm";
const btnCls = "px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold disabled:opacity-60";
const DAYS = ["", "Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

interface Slot { id: string; dayOfWeek: number; startTime: string; endTime: string; subjectName: string; gradeLevel: number; section: string }
interface RegisterRow { studentId: string; studentName: string; status: Status | null; notes: string | null }
interface Editability { editable: boolean; reason?: string; message?: string }

const slotLabel = (s: Slot) => `${DAYS[s.dayOfWeek]} ${s.startTime} · ${s.gradeLevel}-${s.section} · ${s.subjectName}`;
const todayStr = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());

export function AttendanceModule() {
  const { role } = useAuth();
  const { t } = useI18n();
  if (role === "student") return <StudentHistory />;
  if (role === "teacher" || role === "admin") return <StaffAttendance />;
  // Parents are a v2 feature: they have no register, summary or child picker yet.
  return <p className="text-sm text-slate-500">{t.attendance.parentsSoon}</p>;
}

// ---------------------------------------------------------------- student
function StudentHistory() {
  const { t } = useI18n();
  const [records, setRecords] = useState<{ id: string; date: string; slotId: string; status: Status; notes: string | null }[]>([]);
  const [slots, setSlots] = useState<Record<string, Slot>>({});

  useEffect(() => {
    fetch("/api/attendance").then((r) => r.json()).then((d) => setRecords(d.records ?? []));
    fetch("/api/timetable").then((r) => r.json()).then((d) => setSlots(Object.fromEntries((d.slots ?? []).map((s: Slot) => [s.id, s]))));
  }, []);

  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
  const counted = records.filter((r) => r.status !== "excused");
  const rate = counted.length ? Math.round((counted.filter((r) => r.status !== "absent").length / counted.length) * 1000) / 10 : null;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t.attendance.history}</h2>
        {rate !== null && <span className="text-sm font-bold text-emerald-600">{t.attendance.rate}: {rate}%</span>}
      </div>
      {!sorted.length ? <p className="text-sm text-slate-500">{t.attendance.noRecords}</p> : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          {sorted.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span>{r.date} <span className="text-slate-500">· {slots[r.slotId]?.subjectName ?? ""}</span>{r.notes && <span className="block text-xs text-slate-400">{r.notes}</span>}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold text-white ${STATUS_STYLE[r.status].split(" ")[0]}`}>{t.attendance[r.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- teacher / admin
function StaffAttendance() {
  const { t } = useI18n();
  const { role } = useAuth();
  const [tab, setTab] = useState<"register" | "summary" | "approvals">("register");
  const tabs = [["register", t.attendance.register], ["summary", t.attendance.summary], ...(role === "admin" ? [["approvals", t.attendance.approvals]] : [])] as [typeof tab, string][];
  return (
    <div className="space-y-5">
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-3 py-2 text-sm font-semibold -mb-px border-b-2 ${tab === id ? "border-sky-600 text-sky-700 dark:text-sky-300" : "border-transparent text-slate-500"}`}>{label}</button>
        ))}
      </div>
      {tab === "register" && <Register />}
      {tab === "summary" && <Summary />}
      {tab === "approvals" && <Approvals />}
    </div>
  );
}

function useSlots() {
  const [slots, setSlots] = useState<Slot[]>([]);
  useEffect(() => { fetch("/api/timetable").then((r) => r.json()).then((d) => setSlots(d.slots ?? [])); }, []);
  return slots;
}

function Register() {
  const { t } = useI18n();
  const slots = useSlots();
  const [slotId, setSlotId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [edit, setEdit] = useState<Editability | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { if (!slotId && slots[0]) setSlotId(slots[0].id); }, [slots, slotId]);

  const load = useCallback(async () => {
    if (!slotId || !date) return;
    const r = await fetch(`/api/attendance/register?slotId=${slotId}&date=${date}`);
    if (!r.ok) { setRows([]); setMsg({ ok: false, text: (await r.json()).error }); return; }
    const d = await r.json();
    setRows(d.students);
    setEdit(d.editability);
    // Present by default: a saved status wins, otherwise "present".
    setStatus(Object.fromEntries(d.students.map((s: RegisterRow) => [s.studentId, s.status ?? "present"])));
    setMsg(null);
  }, [slotId, date]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const r = await fetch("/api/attendance", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records: rows.map((s) => ({ slotId, studentId: s.studentId, date, status: status[s.studentId] })) }),
    });
    const d = await r.json();
    setMsg(r.ok ? { ok: true, text: t.attendance.saved } : { ok: false, text: d.error });
    if (r.ok) load();
  };

  const counts = useMemo(() => STATUSES.map((s) => [s, Object.values(status).filter((v) => v === s).length] as const), [status]);
  const locked = edit ? !edit.editable : false;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-xs font-semibold">{t.attendance.lesson}
          <select value={slotId} onChange={(e) => setSlotId(e.target.value)} className={`${inputCls} block mt-1`}>
            {slots.map((s) => <option key={s.id} value={s.id}>{slotLabel(s)}</option>)}
          </select></label>
        <label className="text-xs font-semibold">{t.attendance.date}
          <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} className={`${inputCls} block mt-1`} /></label>
      </div>
      {locked && <p role="status" className="text-xs rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 text-amber-800 dark:text-amber-300 p-2">
        {edit?.reason === "future" ? t.attendance.future : t.attendance.needsApproval}</p>}
      {!locked && <p className="text-xs text-slate-500">{t.attendance.allPresentHint}</p>}
      <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {rows.map((s) => (
          <li key={s.studentId} className="flex items-center justify-between gap-3 p-3">
            <span className="text-sm">{s.studentName}</span>
            <div className="flex gap-1" role="group" aria-label={s.studentName}>
              {STATUSES.map((st) => (
                <button key={st} type="button" disabled={locked} aria-pressed={status[s.studentId] === st} title={t.attendance[st]}
                  onClick={() => setStatus({ ...status, [s.studentId]: st })}
                  className={`w-9 h-9 rounded-lg border text-xs font-bold disabled:opacity-50 ${status[s.studentId] === st ? STATUS_STYLE[st] : "border-slate-200 dark:border-slate-700 text-slate-500"}`}>
                  {t.attendance[({ present: "p", absent: "a", late: "l", excused: "e" } as const)[st]]}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={locked || !rows.length} className={btnCls}>{t.attendance.save}</button>
        <span className="text-xs text-slate-500">{counts.map(([s, n]) => `${t.attendance[s]}: ${n}`).join(" · ")}</span>
        {msg && <p role="status" className={`text-xs ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>}
      </div>
    </div>
  );
}

function Summary() {
  const { t } = useI18n();
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classId, setClassId] = useState("");
  const [to, setTo] = useState(todayStr());
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10));
  const [rows, setRows] = useState<{ studentId: string; studentName: string; present: number; absent: number; late: number; excused: number; rate: number | null }[]>([]);

  useEffect(() => {
    fetch("/api/classes").then((r) => r.json()).then((d) => { setClasses(d.classes ?? []); if (d.classes?.[0]) setClassId(d.classes[0].id); });
  }, []);
  useEffect(() => {
    if (!classId) return;
    fetch(`/api/attendance/summary?classId=${classId}&from=${from}&to=${to}`).then((r) => (r.ok ? r.json() : { students: [] })).then((d) => setRows(d.students));
  }, [classId, from, to]);

  if (!classes.length) return <p className="text-sm text-slate-500">{t.attendance.noClasses}</p>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-xs font-semibold">{t.attendance.class}
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className={`${inputCls} block mt-1`}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="text-xs font-semibold">{t.attendance.from}<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} block mt-1`} /></label>
        <label className="text-xs font-semibold">{t.attendance.to}<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} block mt-1`} /></label>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-500">
            <tr><th className="p-3" />{STATUSES.map((s) => <th key={s} className="p-3">{t.attendance[s]}</th>)}<th className="p-3">{t.attendance.rate}</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.studentId} className="border-t border-slate-100 dark:border-slate-800">
                <td className="p-3">{r.studentName}</td>
                {STATUSES.map((s) => <td key={s} className="p-3 font-mono">{r[s]}</td>)}
                <td className="p-3 font-bold">{r.rate === null ? "–" : `${r.rate}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Approvals() {
  const { t } = useI18n();
  const slots = useSlots();
  const [slotId, setSlotId] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [list, setList] = useState<{ id: string; slotId: string; date: string; reason: string | null }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => { fetch("/api/attendance/approvals").then((r) => r.json()).then((d) => setList(d.approvals ?? [])); }, []);
  useEffect(load, [load]);
  useEffect(() => { if (!slotId && slots[0]) setSlotId(slots[0].id); }, [slots, slotId]);
  const byId = Object.fromEntries(slots.map((s) => [s.id, s]));

  const approve = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch("/api/attendance/approvals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slotId, date, reason }) });
    setMsg(r.ok ? t.attendance.saved : (await r.json()).error);
    if (r.ok) { setReason(""); load(); }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={approve} className="flex flex-wrap gap-3 items-end">
        <label className="text-xs font-semibold">{t.attendance.lesson}
          <select value={slotId} onChange={(e) => setSlotId(e.target.value)} className={`${inputCls} block mt-1`}>{slots.map((s) => <option key={s.id} value={s.id}>{slotLabel(s)}</option>)}</select></label>
        <label className="text-xs font-semibold">{t.attendance.date}<input type="date" required max={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} block mt-1`} /></label>
        <label className="text-xs font-semibold">{t.attendance.reason}<input value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputCls} block mt-1`} /></label>
        <button type="submit" className={btnCls}>{t.attendance.approve}</button>
        {msg && <p role="status" className="text-xs text-slate-600">{msg}</p>}
      </form>
      <h3 className="text-sm font-semibold">{t.attendance.approvedList}</h3>
      <ul className="text-sm divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
        {list.map((a) => <li key={a.id} className="p-3">{a.date} · {byId[a.slotId] ? slotLabel(byId[a.slotId]) : a.slotId}{a.reason && <span className="text-slate-400"> · {a.reason}</span>}</li>)}
      </ul>
    </div>
  );
}
