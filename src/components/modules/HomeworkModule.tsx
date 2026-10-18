"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Paperclip } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/i18n/context";

interface Homework {
  id: string; className: string; subjectName: string; teacherName: string; description: string;
  dueDate: string; hasAttachment: boolean; attachmentName: string | null; done: boolean;
}
interface Course { id: string; className: string; subjectName: string }

const inputCls = "px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm";
const btnCls = "px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold disabled:opacity-60";
const todayStr = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());

function Attachment({ hw }: { hw: Homework }) {
  const { t } = useI18n();
  if (!hw.hasAttachment) return null;
  return (
    <a href={`/api/homework/${hw.id}/attachment`} className="inline-flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 hover:underline">
      <Paperclip className="w-3.5 h-3.5" />{hw.attachmentName ?? t.homework.download}
    </a>
  );
}

export function HomeworkModule() {
  const { role } = useAuth();
  return role === "student" ? <StudentHomework /> : <TeacherHomework />;
}

function StudentHomework() {
  const { t } = useI18n();
  const [items, setItems] = useState<Homework[]>([]);
  const [showPast, setShowPast] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/homework${showPast ? "?all=1" : ""}`).then((r) => r.json()).then((d) => setItems(d.homework ?? []));
  }, [showPast]);
  useEffect(load, [load]);

  const toggle = async (hw: Homework) => {
    setItems((prev) => prev.map((x) => (x.id === hw.id ? { ...x, done: !x.done } : x))); // optimistic
    const r = await fetch(`/api/homework/${hw.id}/done`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: !hw.done }) });
    if (!r.ok) load();
  };

  const today = todayStr();
  const groups: [string, Homework[]][] = [
    [t.homework.past, items.filter((h) => h.dueDate < today)],
    [t.homework.today, items.filter((h) => h.dueDate === today)],
    [t.homework.upcoming, items.filter((h) => h.dueDate > today)],
  ];
  // Today first, then upcoming, then (optionally) earlier.
  const ordered = [groups[1], groups[2], groups[0]].filter(([, list]) => list.length);

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t.homework.title}</h2>
        <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />{t.homework.showPast}</label>
      </div>
      {!ordered.length && <p className="text-sm text-slate-500">{t.homework.none}</p>}
      {ordered.map(([title, list]) => (
        <section key={title} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
          <ul className="space-y-2">
            {list.map((h) => (
              <li key={h.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex gap-3">
                <input type="checkbox" checked={h.done} onChange={() => toggle(h)} aria-label={t.homework.done} className="mt-1 w-5 h-5" />
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{h.subjectName} <span className="font-normal text-slate-400">· {h.dueDate}</span></p>
                  <p className={`text-sm whitespace-pre-wrap break-words ${h.done ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-300"}`}>{h.description}</p>
                  <Attachment hw={h} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TeacherHomework() {
  const { t } = useI18n();
  const [courses, setCourses] = useState<Course[]>([]);
  const [items, setItems] = useState<Homework[]>([]);
  const [form, setForm] = useState({ courseId: "", description: "", dueDate: todayStr() });
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { fetch("/api/homework").then((r) => r.json()).then((d) => setItems(d.homework ?? [])); }, []);
  useEffect(() => {
    load();
    fetch("/api/courses").then((r) => r.json()).then((d) => { setCourses(d.courses ?? []); setForm((f) => ({ ...f, courseId: f.courseId || d.courses?.[0]?.id || "" })); });
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const body = new FormData();
    body.set("courseId", form.courseId);
    body.set("description", form.description);
    body.set("dueDate", form.dueDate);
    if (file) body.set("file", file);
    const r = await fetch("/api/homework", { method: "POST", body });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: d.error });
    setMsg({ ok: true, text: t.homework.posted });
    setForm((f) => ({ ...f, description: "" }));
    setFile(null);
    setFileKey((k) => k + 1);
    load();
  };

  const remove = async (hw: Homework) => {
    if (!confirm(t.homework.confirmDelete)) return;
    await fetch(`/api/homework/${hw.id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t.homework.title}</h2>
      <form onSubmit={submit} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold">{t.homework.course}
            <select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })} className={`${inputCls} w-full mt-1`}>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.className} · {c.subjectName}</option>)}</select></label>
          <label className="text-xs font-semibold">{t.homework.dueDate}
            <input type="date" required min={todayStr()} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={`${inputCls} w-full mt-1`} /></label>
        </div>
        <label className="text-xs font-semibold block">{t.homework.description}
          <textarea required rows={3} maxLength={5000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputCls} w-full mt-1`} /></label>
        <label className="text-xs font-semibold block">{t.homework.file}
          <input key={fileKey} type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.docx,.xlsx,.pptx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block mt-1 text-sm" /></label>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy} className={btnCls}>{t.homework.post}</button>
          {msg && <p role="status" className={`text-xs ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>}
        </div>
      </form>
      {!items.length && <p className="text-sm text-slate-500">{t.homework.none}</p>}
      <ul className="space-y-2">
        {items.map((h) => (
          <li key={h.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-semibold">{h.className} · {h.subjectName} <span className="font-normal text-slate-400">· {h.dueDate}</span></p>
              <p className="text-sm whitespace-pre-wrap break-words text-slate-700 dark:text-slate-300">{h.description}</p>
              <Attachment hw={h} />
            </div>
            <button onClick={() => remove(h)} className="self-start px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600">{t.homework.delete}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
