"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/i18n/context";
import { api, cardCls, inputCls } from "./ui";
import type { Transcript } from "@/lib/transcript";

interface Data {
  student: { fullName: string; className: string; yearName: string };
  termName: string | null;
  transcript: Transcript;
}

export function TranscriptModule() {
  const { t } = useI18n();
  const { user, role } = useAuth();
  const staff = role !== "student";
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classId, setClassId] = useState("");
  const [students, setStudents] = useState<{ id: string; fullName: string }[]>([]);
  const [studentId, setStudentId] = useState(staff ? "" : (user?.id ?? ""));
  const [terms, setTerms] = useState<{ id: string; name: string }[]>([]);
  const [termId, setTermId] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ terms: { id: string; name: string }[] }>("/api/terms").then((r) => setTerms(r.data.terms ?? []));
    if (staff) api<{ classes: { id: string; name: string }[] }>("/api/classes").then((r) => { setClasses(r.data.classes ?? []); if (r.data.classes?.[0]) setClassId(r.data.classes[0].id); });
  }, [staff]);

  useEffect(() => {
    if (!staff || !classId) return;
    api<{ students: { id: string; fullName: string }[] }>(`/api/classes/${classId}/students`).then((r) => { setStudents(r.data.students ?? []); setStudentId(r.data.students?.[0]?.id ?? ""); });
  }, [staff, classId]);

  useEffect(() => {
    if (!studentId) { setData(null); return; }
    api<Data>(`/api/transcripts/${studentId}${termId ? `?termId=${termId}` : ""}`).then((r) => {
      setError(r.ok ? null : (r.data.error ?? "Error"));
      setData(r.ok ? r.data : null);
    });
  }, [studentId, termId]);

  if (staff && !classes.length) return <p className="text-sm text-slate-500">{t.transcript.noClasses}</p>;
  const tr = data?.transcript;
  const oneTerm = !!termId;
  const pdf = (lang: string) => `/api/transcripts/${studentId}/pdf?lang=${lang}${termId ? `&termId=${termId}` : ""}`;
  const linkCls = "inline-block px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold";

  return (
    <div className="space-y-4 max-w-3xl">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t.transcript.title}</h2>
      <div className="flex flex-wrap gap-3 items-end">
        {staff && (
          <>
            <label className="text-xs font-semibold">{t.transcript.class}
              <select value={classId} onChange={(e) => setClassId(e.target.value)} className={`${inputCls} block mt-1`}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label className="text-xs font-semibold">{t.transcript.student}
              <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={`${inputCls} block mt-1`}>{students.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}</select></label>
          </>
        )}
        <label className="text-xs font-semibold">{t.transcript.period}
          <select value={termId} onChange={(e) => setTermId(e.target.value)} className={`${inputCls} block mt-1`}>
            <option value="">{t.transcript.fullYear}</option>{terms.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      </div>
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {data && tr && (
        <div className={`${cardCls} p-4 space-y-3`}>
          <p className="text-sm"><strong>{data.student.fullName}</strong> · {data.student.className} · {data.student.yearName}</p>
          {!tr.subjects.length ? <p className="text-sm text-slate-500">{t.transcript.noMarks}</p> : (
            <div className="overflow-x-auto"><table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-500"><tr>
                <th className="p-2">{t.transcript.subject}</th><th className="p-2">{t.transcript.teacher}</th>
                {!oneTerm && tr.terms.length > 1 && tr.terms.map((x) => <th key={x.id} className="p-2 text-center">{x.name}</th>)}
                <th className="p-2 text-center">{oneTerm ? t.transcript.termAvg : t.transcript.yearAvg}</th><th className="p-2 text-center">{t.transcript.grade}</th></tr></thead>
              <tbody>
                {tr.subjects.map((s) => (
                  <tr key={s.subjectId} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="p-2">{s.subjectName}</td><td className="p-2 text-slate-500">{s.teacherName}</td>
                    {!oneTerm && tr.terms.length > 1 && tr.terms.map((x) => <td key={x.id} className="p-2 text-center">{s.terms[x.id] ? `${s.terms[x.id]!.average}%` : "–"}</td>)}
                    <td className="p-2 text-center">{s.periodAverage}%</td><td className="p-2 text-center font-bold">{s.periodGrade ?? "–"}</td>
                  </tr>))}
                <tr className="border-t-2 border-slate-300 dark:border-slate-600 font-semibold"><td className="p-2" colSpan={2}>{t.transcript.overall}</td>
                  {!oneTerm && tr.terms.length > 1 && tr.terms.map((x) => <td key={x.id} className="p-2 text-center">{tr.overall.terms[x.id] !== undefined ? `${tr.overall.terms[x.id]}%` : "–"}</td>)}
                  <td className="p-2 text-center">{tr.overall.period !== null ? `${tr.overall.period}%` : "–"}</td><td className="p-2 text-center">{tr.overall.grade ?? "–"}</td></tr>
              </tbody></table></div>)}
          <div className="flex gap-3 pt-2"><a href={pdf("uz")} className={linkCls}>{t.transcript.downloadUz}</a><a href={pdf("en")} className={linkCls}>{t.transcript.downloadEn}</a></div>
        </div>
      )}
    </div>
  );
}
