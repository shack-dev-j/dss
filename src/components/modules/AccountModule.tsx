"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/i18n/context";

export function AccountModule() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? { ok: true, text: t.auth.passwordChanged } : { ok: false, text: data.error || "Error" });
    if (res.ok) {
      setCurrent("");
      setNext("");
    }
  };

  return (
    <div className="max-w-md space-y-4">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t.auth.account}</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {user?.fullName} · <span className="font-mono">{user?.username}</span>
      </p>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs font-semibold">
          {t.auth.currentPassword}
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
        </label>
        <label className="block text-xs font-semibold">
          {t.auth.newPassword}
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} autoComplete="new-password"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
        </label>
        <button type="submit" className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold">
          {t.auth.changePassword}
        </button>
        {msg && <p role="status" className={`text-xs ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>}
      </form>
    </div>
  );
}
