"use client";

import React, { useState } from "react";
import { useI18n } from "@/i18n/context";
import { api, btnCls, cardCls, inputCls } from "./ui";

const TEMPLATE = "fullName,username,gradeLevel,section\nAli Valiyev,ali.valiyev,9,A\nNilufar Yoqubova,nilufar.yoqubova,9,A\n";

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

interface Result { success?: boolean; isDryRun?: boolean; totalRows?: number; classes?: string[]; errors?: string[]; moreErrors?: number; created?: number; createdClasses?: number; credentialsCsv?: string; error?: string }

export function CsvImportModule() {
  const { t } = useI18n();
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [checked, setChecked] = useState(false);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setCsv(await f.text());
    setRes(null);
    setChecked(false);
  };

  const run = async (isDryRun: boolean) => {
    setBusy(true);
    const r = await api<Result>("/api/import/csv", "POST", { entityType: "students", csvContent: csv, isDryRun });
    setRes(r.data);
    setChecked(r.ok && isDryRun);
    setBusy(false);
    if (r.ok && !isDryRun && r.data.credentialsCsv) setCsv("");
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t.admin.importTitle}</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400">{t.admin.importIntro}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => download("students_template.csv", TEMPLATE)} className={`${inputCls} hover:bg-slate-50`}>{t.admin.template}</button>
        <label className="text-sm">{t.admin.chooseFile}: <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} /></label>
      </div>
      <textarea value={csv} onChange={(e) => { setCsv(e.target.value); setChecked(false); setRes(null); }} rows={8} spellCheck={false}
        className={`${inputCls} w-full font-mono text-xs`} placeholder={TEMPLATE} />
      <div className="flex gap-3">
        <button disabled={busy || !csv.trim()} onClick={() => run(true)} className={btnCls}>{t.admin.check}</button>
        <button disabled={busy || !checked} onClick={() => run(false)} className={btnCls}>{t.admin.importNow}</button>
      </div>

      {res?.errors && (
        <div role="alert" className={`${cardCls} border-rose-300 p-4 text-sm space-y-1`}>
          <p className="font-semibold text-rose-700">{t.admin.problems}</p>
          <ul className="list-disc pl-5 text-xs">{res.errors.map((e) => <li key={e}>{e}</li>)}</ul>
          {!!res.moreErrors && <p className="text-xs text-slate-500">+ {res.moreErrors} more</p>}
        </div>
      )}
      {res?.error && <p role="alert" className="text-sm text-rose-600">{res.error}</p>}
      {res?.isDryRun && res.success && (
        <p role="status" className="text-sm text-emerald-700">{t.admin.looksGood.replace("{n}", String(res.totalRows)).replace("{c}", (res.classes ?? []).join(", "))}</p>
      )}
      {res?.success && !res.isDryRun && (
        <div className={`${cardCls} border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-2`}>
          <p role="status" className="text-sm font-semibold">{t.admin.importDone.replace("{n}", String(res.created)).replace("{c}", String(res.createdClasses))}</p>
          <p className="text-xs">{t.admin.credsWarning}</p>
          <button onClick={() => download("one-time-passwords.csv", res.credentialsCsv ?? "")} className={btnCls}>{t.admin.downloadCreds}</button>
        </div>
      )}
    </div>
  );
}
