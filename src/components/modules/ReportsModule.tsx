"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/i18n/context";
import { api, cardCls, inputCls } from "./ui";

interface Cls { id: string; name: string }
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());

export function ReportsModule() {
  const { t } = useI18n();
  const { role } = useAuth();
  const [classes, setClasses] = useState<Cls[]>([]);
  // Attendance export is only for the class teacher of a class (or an admin); grades also for subject teachers.
  const [homeroomIds, setHomeroomIds] = useState<Set<string>>(new Set());
  const [classId, setClassId] = useState("");
  const [terms, setTerms] = useState<{ id: string; name: string }[]>([]);
  const [termId, setTermId] = useState("");
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10));
  const [to, setTo] = useState(today());

  useEffect(() => {
    (async () => {
      if (role === "admin") {
        const r = await api<{ classes: Cls[] }>("/api/admin/classes");
        setClasses(r.data.classes ?? []);
      } else {
        // a teacher: classes they teach (grades) plus classes they are class teacher of
        const [c, own] = await Promise.all([api<{ courses: { classId: string; className: string }[] }>("/api/courses"), api<{ classes: Cls[] }>("/api/classes")]);
        const map = new Map<string, string>();
        (c.data.courses ?? []).forEach((x) => map.set(x.classId, x.className));
        (own.data.classes ?? []).forEach((x) => map.set(x.id, x.name));
        setClasses([...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));
        setHomeroomIds(new Set((own.data.classes ?? []).map((x) => x.id)));
      }
      const tr = await api<{ terms: { id: string; name: string }[] }>("/api/terms");
      setTerms(tr.data.terms ?? []);
    })();
  }, [role]);
  useEffect(() => { if (!classId && classes[0]) setClassId(classes[0].id); }, [classes, classId]);

  const gradesUrl = `/api/export/grades?classId=${classId}${termId ? `&termId=${termId}` : ""}`;
  const attUrl = `/api/export/attendance?classId=${classId}&from=${from}&to=${to}`;
  const linkCls = "inline-block px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold";

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t.admin.reports}</h2>
      <p className="text-xs text-slate-500">{t.admin.reportsHint}</p>
      <label className="text-xs font-semibold block">{t.admin.class}
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className={`${inputCls} block mt-1`}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <div className={`${cardCls} p-4 space-y-3`}>
        <h3 className="text-sm font-semibold">{t.admin.gradesCsv}</h3>
        <select value={termId} onChange={(e) => setTermId(e.target.value)} className={inputCls} aria-label={t.marks.term}>
          <option value="">{t.admin.allTerms}</option>{terms.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <div><a href={gradesUrl} className={linkCls} aria-disabled={!classId}>{t.admin.download}</a></div>
      </div>
      <div className={`${cardCls} p-4 space-y-3`}>
        <h3 className="text-sm font-semibold">{t.admin.attendanceCsv}</h3>
        <div className="flex gap-3">
          <label className="text-xs font-semibold">{t.admin.from}<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} block mt-1`} /></label>
          <label className="text-xs font-semibold">{t.admin.to}<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} block mt-1`} /></label>
        </div>
        {role === "admin" || homeroomIds.has(classId)
          ? <div><a href={attUrl} className={linkCls}>{t.admin.download}</a></div>
          : <p className="text-xs text-slate-500">{t.admin.attendanceHomeroomOnly}</p>}
      </div>
    </div>
  );
}
