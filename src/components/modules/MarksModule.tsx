"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/i18n/context";

interface Term { id: string; name: string; closed: boolean }
interface Course { id: string; className: string; subjectName: string; teacherName: string }
interface Assessment { id: string; type: string; title: string; date: string; maxScore: number; termId: string; termClosed: boolean }
interface GridRow { studentId: string; studentName: string; score: number | null; comment: string | null }
interface StudentMark { id: string; title: string; date: string; termId: string; subjectId: string; subjectName: string; score: number; maxScore: number }
interface Summary { termId: string; termName: string; overall: number | null; subjects: { subjectId: string; subjectName: string; average: number }[] }

const inputCls = "px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm";
const btnCls = "px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold disabled:opacity-60";

export function MarksModule() {
  const { role } = useAuth();
  return role === "student" ? <StudentMarks /> : <TeacherMarks />;
}

// ---------------------------------------------------------------- student
function StudentMarks() {
  const { t } = useI18n();
  const [marks, setMarks] = useState<StudentMark[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [termId, setTermId] = useState("");

  useEffect(() => {
    fetch("/api/marks").then((r) => (r.ok ? r.json() : { marks: [], summary: [] })).then((d) => {
      setMarks(d.marks);
      setSummary(d.summary);
      setTermId(d.summary.length ? d.summary[d.summary.length - 1].termId : "");
    });
  }, []);

  const term = summary.find((s) => s.termId === termId);
  if (!summary.length) return <p className="text-sm text-slate-500">{t.marks.noMarks}</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t.marks.title}</h2>
        <select value={termId} onChange={(e) => setTermId(e.target.value)} className={inputCls} aria-label={t.marks.term}>
          {summary.map((s) => <option key={s.termId} value={s.termId}>{s.termName}</option>)}
        </select>
      </div>
      <div className="rounded-2xl border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/30 p-4">
        <p className="text-xs text-slate-500">{t.marks.overall}</p>
        <p className="text-3xl font-bold text-sky-700 dark:text-sky-300">{term?.overall ?? "–"}%</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {term?.subjects.map((s) => (
          <div key={s.subjectId} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">{s.subjectName}</h3>
              <span className="text-sm font-bold">{s.average}%</span>
            </div>
            <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {marks.filter((m) => m.termId === termId && m.subjectId === s.subjectId).map((m) => (
                <li key={m.id} className="flex justify-between py-1.5">
                  <span>{m.title} <span className="text-slate-400">· {m.date}</span></span>
                  <span className="font-mono">{m.score}/{m.maxScore}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- teacher / admin
function TeacherMarks() {
  const { t } = useI18n();
  const { role } = useAuth();
  const [terms, setTerms] = useState<Term[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selected, setSelected] = useState<Assessment | null>(null);
  const [grid, setGrid] = useState<GridRow[]>([]);
  const [edits, setEdits] = useState<Record<string, { score: string; comment: string }>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({ title: "", type: "quiz", date: new Date().toISOString().slice(0, 10), maxScore: "20", termId: "" });

  // Only the terms of the selected class's academic year can be chosen.
  const loadTerms = useCallback((cid: string) => {
    fetch(cid ? `/api/terms?courseId=${cid}` : "/api/terms").then((r) => r.json()).then((d) => {
      setTerms(d.terms);
      setForm((f) => ({ ...f, termId: d.terms.some((x: Term) => x.id === f.termId) ? f.termId : d.terms[0]?.id || "" }));
    });
  }, []);

  useEffect(() => {
    fetch("/api/courses").then((r) => (r.ok ? r.json() : { courses: [] })).then((d) => {
      setCourses(d.courses);
      if (d.courses[0]) setCourseId(d.courses[0].id);
    });
  }, []);

  const loadAssessments = useCallback(async (cid: string) => {
    if (!cid) return;
    const r = await fetch(`/api/assessments?courseId=${cid}`);
    setAssessments(r.ok ? (await r.json()).assessments : []);
  }, []);

  useEffect(() => {
    setSelected(null);
    setGrid([]);
    loadAssessments(courseId);
    loadTerms(courseId);
  }, [courseId, loadAssessments, loadTerms]);

  const openAssessment = async (a: Assessment) => {
    setSelected(a);
    setMsg(null);
    const r = await fetch(`/api/assessments/${a.id}/marks`);
    if (!r.ok) return;
    const d = await r.json();
    setGrid(d.grid);
    setEdits(Object.fromEntries(d.grid.map((g: GridRow) => [g.studentId, { score: g.score === null ? "" : String(g.score), comment: g.comment ?? "" }])));
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch("/api/assessments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, courseId, maxScore: Number(form.maxScore) }),
    });
    const d = await r.json();
    if (!r.ok) return setMsg({ ok: false, text: d.error });
    setForm((f) => ({ ...f, title: "" }));
    await loadAssessments(courseId);
    openAssessment({ ...d.assessment });
  };

  const dirty = useMemo(
    () => grid.filter((g) => {
      const e = edits[g.studentId];
      return e && (e.score !== (g.score === null ? "" : String(g.score)) || e.comment !== (g.comment ?? ""));
    }),
    [grid, edits]
  );

  const save = async () => {
    if (!selected) return;
    const r = await fetch(`/api/assessments/${selected.id}/marks`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marks: dirty.map((g) => ({ studentId: g.studentId, score: edits[g.studentId].score === "" ? null : Number(edits[g.studentId].score), comment: edits[g.studentId].comment })) }),
    });
    const d = await r.json();
    if (!r.ok) return setMsg({ ok: false, text: d.error });
    setMsg({ ok: true, text: t.marks.saved.replace("{n}", String(d.changed)) });
    openAssessment(selected);
  };

  // Enter moves to the next student's score box, so a whole class can be typed without the mouse.
  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input[data-score]"));
    inputs[inputs.indexOf(e.currentTarget) + 1]?.focus();
  };

  const toggleTerm = async (term: Term) => {
    await fetch(`/api/terms/${term.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ closed: !term.closed }),
    });
    loadTerms(courseId);
    loadAssessments(courseId);
    setSelected(null);
  };

  const locked = !!selected?.termClosed && role !== "admin";

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t.marks.title}</h2>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold">
          {t.marks.course}
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={`${inputCls} block mt-1`}>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.className} · {c.subjectName}{role === "admin" ? ` (${c.teacherName})` : ""}</option>)}
          </select>
        </label>
      </div>

      <form onSubmit={create} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 grid gap-3 sm:grid-cols-6 items-end">
        <label className="text-xs font-semibold sm:col-span-2">{t.marks.titleLabel}
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`${inputCls} w-full mt-1`} /></label>
        <label className="text-xs font-semibold">{t.marks.type}
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={`${inputCls} w-full mt-1`}>
            {(["quiz", "test", "homework_check", "exam"] as const).map((k) => <option key={k} value={k}>{t.marks[k]}</option>)}
          </select></label>
        <label className="text-xs font-semibold">{t.marks.term}
          <select value={form.termId} onChange={(e) => setForm({ ...form, termId: e.target.value })} className={`${inputCls} w-full mt-1`}>
            {terms.map((x) => <option key={x.id} value={x.id}>{x.name}{x.closed ? ` (${t.marks.closed})` : ""}</option>)}
          </select></label>
        <label className="text-xs font-semibold">{t.marks.date}
          <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={`${inputCls} w-full mt-1`} /></label>
        <label className="text-xs font-semibold">{t.marks.maxScore}
          <input type="number" min={1} max={1000} required value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} className={`${inputCls} w-full mt-1`} /></label>
        <button type="submit" className={`${btnCls} sm:col-span-6 sm:w-fit`}>{t.marks.create}</button>
      </form>

      <div className="flex flex-wrap gap-2">
        {assessments.map((a) => (
          <button key={a.id} onClick={() => openAssessment(a)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${selected?.id === a.id ? "bg-sky-50 dark:bg-sky-950/40 border-sky-400 text-sky-700 dark:text-sky-300" : "border-slate-200 dark:border-slate-700"}`}>
            {a.title} <span className="text-slate-400">· {a.date} · /{a.maxScore}</span>
          </button>
        ))}
      </div>

      {!selected ? <p className="text-sm text-slate-500">{t.marks.pickAssessment}</p> : (
        <div className="space-y-3">
          {selected.termClosed && <p role="status" className="text-xs rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 text-amber-800 dark:text-amber-300 p-2">{t.marks.closedBanner}</p>}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-500 text-left">
                <tr><th className="p-3">{t.marks.student}</th><th className="p-3 w-32">{t.marks.score} (/{selected.maxScore})</th><th className="p-3">{t.marks.comment}</th></tr>
              </thead>
              <tbody>
                {grid.map((g) => (
                  <tr key={g.studentId} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="p-3">{g.studentName}</td>
                    <td className="p-2">
                      <input data-score type="number" inputMode="numeric" min={0} max={selected.maxScore} disabled={locked}
                        value={edits[g.studentId]?.score ?? ""} onKeyDown={onEnter} aria-label={`${g.studentName} ${t.marks.score}`}
                        onChange={(e) => setEdits({ ...edits, [g.studentId]: { ...edits[g.studentId], score: e.target.value } })}
                        className={`${inputCls} w-24`} />
                    </td>
                    <td className="p-2">
                      <input value={edits[g.studentId]?.comment ?? ""} disabled={locked} aria-label={`${g.studentName} ${t.marks.comment}`}
                        onChange={(e) => setEdits({ ...edits, [g.studentId]: { ...edits[g.studentId], comment: e.target.value } })}
                        className={`${inputCls} w-full`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={locked || dirty.length === 0} className={btnCls}>{t.marks.save}{dirty.length ? ` (${dirty.length})` : ""}</button>
            {msg && <p role="status" className={`text-xs ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>}
          </div>
        </div>
      )}

      {role === "admin" && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <h3 className="text-sm font-semibold mb-2">{t.marks.terms}</h3>
          <ul className="space-y-1.5 text-sm">
            {terms.map((x) => (
              <li key={x.id} className="flex items-center justify-between">
                <span>{x.name} · <span className="text-slate-500">{x.closed ? t.marks.closed : t.marks.open}</span></span>
                <button onClick={() => toggleTerm(x)} className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                  {x.closed ? t.marks.reopenTerm : t.marks.closeTerm}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
