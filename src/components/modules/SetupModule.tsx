"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n/context";
import { api, btnCls, cardCls, inputCls, smallBtn } from "./ui";

interface Cls { id: string; name: string; classTeacherId: string | null; classTeacherName: string | null; students: number }
interface Person { id: string; fullName: string; role: string; active: boolean }
interface Subject { id: string; code: string; nameUz: string; nameEn: string }
interface Course { id: string; teacherId: string; teacherName: string; classId: string; className: string; subjectId: string; subjectName: string }
interface Term { id: string; name: string; startDate: string; endDate: string; closed: boolean }
interface Slot { id: string; dayOfWeek: number; startTime: string; endTime: string; room: string; courseId: string; subjectName: string; gradeLevel: number; section: string; teacherName: string }
type Scale = { mode: "percent" } | { mode: "five_point"; thresholds: { five: number; four: number; three: number } };
const DAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Tab = "classes" | "subjects" | "teaching" | "timetable" | "terms" | "grading";

export function SetupModule() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("classes");
  const tabs: [Tab, string][] = [["classes", t.admin.classes], ["subjects", t.admin.subjects], ["teaching", t.admin.teaching], ["timetable", t.admin.timetable], ["terms", t.admin.terms], ["grading", t.admin.grading]];
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t.admin.setup}</h2>
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-3 py-2 text-sm font-semibold -mb-px border-b-2 ${tab === id ? "border-sky-600 text-sky-700 dark:text-sky-300" : "border-transparent text-slate-500"}`}>{label}</button>
        ))}
      </div>
      {tab === "classes" && <Classes />}
      {tab === "subjects" && <Subjects />}
      {tab === "teaching" && <Teaching />}
      {tab === "timetable" && <Timetable />}
      {tab === "terms" && <Terms />}
      {tab === "grading" && <Grading />}
    </div>
  );
}

function Notice({ msg }: { msg: { ok: boolean; text: string } | null }) {
  return msg ? <p role="status" className={`text-xs ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p> : null;
}

function useTeachers() {
  const [teachers, setTeachers] = useState<Person[]>([]);
  useEffect(() => { api<{ users: Person[] }>("/api/admin/users").then((r) => setTeachers((r.data.users ?? []).filter((u) => u.role === "teacher" && u.active))); }, []);
  return teachers;
}

function Classes() {
  const { t } = useI18n();
  const teachers = useTeachers();
  const [list, setList] = useState<Cls[]>([]);
  const [form, setForm] = useState({ gradeLevel: "10", section: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => { api<{ classes: Cls[] }>("/api/admin/classes").then((r) => setList(r.data.classes ?? [])); }, []);
  useEffect(load, [load]);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await api("/api/admin/classes", "POST", { gradeLevel: Number(form.gradeLevel), section: form.section });
    setMsg(r.ok ? { ok: true, text: t.admin.saved } : { ok: false, text: r.data.error ?? "Error" });
    if (r.ok) { setForm({ ...form, section: "" }); load(); }
  };
  const setTeacher = async (c: Cls, id: string) => {
    const r = await api(`/api/admin/classes/${c.id}`, "PATCH", { classTeacherId: id || null });
    setMsg(r.ok ? { ok: true, text: t.admin.saved } : { ok: false, text: r.data.error ?? "Error" });
    load();
  };
  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex flex-wrap gap-3 items-end">
        <label className="text-xs font-semibold">{t.admin.grade}<input type="number" min={1} max={12} required value={form.gradeLevel} onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })} className={`${inputCls} w-24 block mt-1`} /></label>
        <label className="text-xs font-semibold">{t.admin.section}<input required maxLength={3} value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} className={`${inputCls} w-24 block mt-1`} /></label>
        <button className={btnCls}>{t.admin.add}</button><Notice msg={msg} />
      </form>
      <div className={`${cardCls} overflow-x-auto`}><table className="w-full text-sm text-left">
        <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-500"><tr><th className="p-3">{t.admin.class}</th><th className="p-3">{t.admin.studentsCount}</th><th className="p-3">{t.admin.classTeacher}</th></tr></thead>
        <tbody>{list.map((c) => (
          <tr key={c.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3 font-semibold">{c.name}</td><td className="p-3">{c.students}</td>
            <td className="p-3"><select value={c.classTeacherId ?? ""} onChange={(e) => setTeacher(c, e.target.value)} className={`${inputCls} py-1`}>
              <option value="">{t.admin.noTeacher}</option>{teachers.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></td></tr>))}</tbody></table></div>
    </div>
  );
}

function Subjects() {
  const { t } = useI18n();
  const [list, setList] = useState<Subject[]>([]);
  const [form, setForm] = useState({ code: "", nameUz: "", nameEn: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => { api<{ subjects: Subject[] }>("/api/admin/subjects").then((r) => setList(r.data.subjects ?? [])); }, []);
  useEffect(load, [load]);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await api("/api/admin/subjects", "POST", form);
    setMsg(r.ok ? { ok: true, text: t.admin.saved } : { ok: false, text: r.data.error ?? "Error" });
    if (r.ok) { setForm({ code: "", nameUz: "", nameEn: "" }); load(); }
  };
  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex flex-wrap gap-3 items-end">
        <label className="text-xs font-semibold">{t.admin.code}<input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={`${inputCls} w-28 block mt-1`} /></label>
        <label className="text-xs font-semibold">{t.admin.nameUz}<input required value={form.nameUz} onChange={(e) => setForm({ ...form, nameUz: e.target.value })} className={`${inputCls} block mt-1`} /></label>
        <label className="text-xs font-semibold">{t.admin.nameEn}<input required value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className={`${inputCls} block mt-1`} /></label>
        <button className={btnCls}>{t.admin.add}</button><Notice msg={msg} />
      </form>
      <ul className={`${cardCls} divide-y divide-slate-100 dark:divide-slate-800 text-sm`}>
        {list.map((s) => <li key={s.id} className="p-3"><span className="font-mono text-xs text-slate-500 mr-2">{s.code}</span>{s.nameUz} <span className="text-slate-400">/ {s.nameEn}</span></li>)}
      </ul>
    </div>
  );
}

function Teaching() {
  const { t } = useI18n();
  const teachers = useTeachers();
  const [courses, setCourses] = useState<Course[]>([]);
  const [classes, setClasses] = useState<Cls[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [form, setForm] = useState({ classId: "", subjectId: "", teacherId: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => {
    api<{ courses: Course[] }>("/api/admin/courses").then((r) => setCourses(r.data.courses ?? []));
  }, []);
  useEffect(() => {
    load();
    api<{ classes: Cls[] }>("/api/admin/classes").then((r) => setClasses(r.data.classes ?? []));
    api<{ subjects: Subject[] }>("/api/admin/subjects").then((r) => setSubjects(r.data.subjects ?? []));
  }, [load]);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await api("/api/admin/courses", "POST", form);
    setMsg(r.ok ? { ok: true, text: t.admin.saved } : { ok: false, text: r.data.error ?? "Error" });
    if (r.ok) load();
  };
  const change = async (c: Course, teacherId: string) => {
    const r = await api(`/api/admin/courses/${c.id}`, "PATCH", { teacherId });
    setMsg(r.ok ? { ok: true, text: t.admin.saved } : { ok: false, text: r.data.error ?? "Error" });
    load();
  };
  const remove = async (c: Course) => {
    if (!confirm(t.admin.confirmDelete)) return;
    const r = await api(`/api/admin/courses/${c.id}`, "DELETE");
    setMsg(r.ok ? { ok: true, text: t.admin.saved } : { ok: false, text: r.data.error ?? "Error" });
    load();
  };
  const sel = (key: "classId" | "subjectId" | "teacherId", label: string, opts: { id: string; label: string }[]) => (
    <label className="text-xs font-semibold">{label}
      <select required value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={`${inputCls} block mt-1`}>
        <option value="" />{opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
  );
  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex flex-wrap gap-3 items-end">
        {sel("classId", t.admin.class, classes.map((c) => ({ id: c.id, label: c.name })))}
        {sel("subjectId", t.admin.subject, subjects.map((s) => ({ id: s.id, label: s.nameUz })))}
        {sel("teacherId", t.admin.teacher, teachers.map((p) => ({ id: p.id, label: p.fullName })))}
        <button className={btnCls}>{t.admin.add}</button><Notice msg={msg} />
      </form>
      <div className={`${cardCls} overflow-x-auto`}><table className="w-full text-sm text-left">
        <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-500"><tr><th className="p-3">{t.admin.class}</th><th className="p-3">{t.admin.subject}</th><th className="p-3">{t.admin.teacher}</th><th className="p-3" /></tr></thead>
        <tbody>{courses.map((c) => (
          <tr key={c.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3 font-semibold">{c.className}</td><td className="p-3">{c.subjectName}</td>
            <td className="p-3"><select value={c.teacherId} onChange={(e) => change(c, e.target.value)} className={`${inputCls} py-1`}>
              {teachers.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></td>
            <td className="p-3 text-right"><button className={smallBtn} onClick={() => remove(c)}>{t.admin.delete}</button></td></tr>))}</tbody></table></div>
    </div>
  );
}

function Timetable() {
  const { t } = useI18n();
  const [courses, setCourses] = useState<Course[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [form, setForm] = useState({ courseId: "", dayOfWeek: "1", startTime: "08:30", endTime: "09:15", room: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => { api<{ slots: Slot[] }>("/api/timetable").then((r) => setSlots(r.data.slots ?? [])); }, []);
  useEffect(() => { load(); api<{ courses: Course[] }>("/api/admin/courses").then((r) => setCourses(r.data.courses ?? [])); }, [load]);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await api("/api/admin/timetable", "POST", { ...form, dayOfWeek: Number(form.dayOfWeek) });
    setMsg(r.ok ? { ok: true, text: t.admin.saved } : { ok: false, text: r.data.error ?? "Error" });
    if (r.ok) load();
  };
  const remove = async (s: Slot) => {
    if (!confirm(t.admin.confirmDelete)) return;
    const r = await api(`/api/admin/timetable/${s.id}`, "DELETE");
    setMsg(r.ok ? { ok: true, text: t.admin.saved } : { ok: false, text: r.data.error ?? "Error" });
    load();
  };
  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex flex-wrap gap-3 items-end">
        <label className="text-xs font-semibold">{t.admin.teaching}
          <select required value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })} className={`${inputCls} block mt-1`}>
            <option value="" />{courses.map((c) => <option key={c.id} value={c.id}>{c.className} · {c.subjectName} · {c.teacherName}</option>)}</select></label>
        <label className="text-xs font-semibold">{t.admin.day}
          <select value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })} className={`${inputCls} block mt-1`}>{[1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{DAYS[d]}</option>)}</select></label>
        <label className="text-xs font-semibold">{t.admin.start}<input type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className={`${inputCls} block mt-1`} /></label>
        <label className="text-xs font-semibold">{t.admin.end}<input type="time" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className={`${inputCls} block mt-1`} /></label>
        <label className="text-xs font-semibold">{t.admin.room}<input required value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className={`${inputCls} w-28 block mt-1`} /></label>
        <button className={btnCls}>{t.admin.add}</button><Notice msg={msg} />
      </form>
      <ul className={`${cardCls} divide-y divide-slate-100 dark:divide-slate-800 text-sm`}>
        {slots.map((s) => (
          <li key={s.id} className="p-3 flex justify-between gap-3"><span>{DAYS[s.dayOfWeek]} {s.startTime}–{s.endTime} · {s.gradeLevel}-{s.section} · {s.subjectName} · {s.teacherName} · {s.room}</span>
            <button className={smallBtn} onClick={() => remove(s)}>{t.admin.delete}</button></li>))}
      </ul>
    </div>
  );
}

function Terms() {
  const { t } = useI18n();
  const [terms, setTerms] = useState<Term[]>([]);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => { api<{ terms: Term[] }>("/api/terms").then((r) => setTerms(r.data.terms ?? [])); }, []);
  useEffect(load, [load]);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await api("/api/terms", "POST", form);
    setMsg(r.ok ? { ok: true, text: t.admin.saved } : { ok: false, text: r.data.error ?? "Error" });
    if (r.ok) { setForm({ name: "", startDate: "", endDate: "" }); load(); }
  };
  const toggle = async (x: Term) => { await api(`/api/terms/${x.id}`, "PATCH", { closed: !x.closed }); load(); };
  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex flex-wrap gap-3 items-end">
        <label className="text-xs font-semibold">{t.admin.termName}<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${inputCls} block mt-1`} /></label>
        <label className="text-xs font-semibold">{t.admin.from}<input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={`${inputCls} block mt-1`} /></label>
        <label className="text-xs font-semibold">{t.admin.to}<input type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={`${inputCls} block mt-1`} /></label>
        <button className={btnCls}>{t.admin.add}</button><Notice msg={msg} />
      </form>
      <ul className={`${cardCls} divide-y divide-slate-100 dark:divide-slate-800 text-sm`}>
        {terms.map((x) => (
          <li key={x.id} className="p-3 flex justify-between"><span>{x.name} · {x.startDate} → {x.endDate}{x.closed && <span className="ml-2 text-amber-600">({t.admin.closed})</span>}</span>
            <button className={smallBtn} onClick={() => toggle(x)}>{x.closed ? t.marks.reopenTerm : t.marks.closeTerm}</button></li>))}
      </ul>
    </div>
  );
}

function Grading() {
  const { t } = useI18n();
  const [scale, setScale] = useState<Scale>({ mode: "five_point", thresholds: { five: 86, four: 71, three: 55 } });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { api<{ gradingScale: Scale }>("/api/admin/settings").then((r) => r.data.gradingScale && setScale(r.data.gradingScale)); }, []);
  const save = async () => {
    const r = await api("/api/admin/settings", "PUT", { gradingScale: scale });
    setMsg(r.ok ? { ok: true, text: t.admin.saved } : { ok: false, text: r.data.error ?? "Error" });
  };
  const th = scale.mode === "five_point" ? scale.thresholds : { five: 86, four: 71, three: 55 };
  const setTh = (k: "five" | "four" | "three", v: string) => setScale({ mode: "five_point", thresholds: { ...th, [k]: Number(v) } });
  return (
    <div className="space-y-4 max-w-md">
      <label className="text-xs font-semibold block">{t.admin.grading}
        <select value={scale.mode} onChange={(e) => setScale(e.target.value === "percent" ? { mode: "percent" } : { mode: "five_point", thresholds: th })} className={`${inputCls} block mt-1`}>
          <option value="five_point">{t.admin.fivePoint}</option><option value="percent">{t.admin.percentMode}</option></select></label>
      {scale.mode === "five_point" && (
        <div><p className="text-xs font-semibold mb-1">{t.admin.thresholds}</p>
          <div className="flex gap-2">{(["five", "four", "three"] as const).map((k) => (
            <input key={k} type="number" min={0} max={100} value={th[k]} onChange={(e) => setTh(k, e.target.value)} aria-label={k} className={`${inputCls} w-20`} />))}</div></div>)}
      <div className="flex items-center gap-3"><button onClick={save} className={btnCls}>{t.admin.save}</button><Notice msg={msg} /></div>
    </div>
  );
}
