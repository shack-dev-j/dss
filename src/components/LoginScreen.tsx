"use client";

import React, { useState } from "react";
import { GraduationCap } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/i18n/context";
import type { UserRole } from "@/types";

const DEMO_ROLES: UserRole[] = ["student", "teacher", "admin"];

export function LoginScreen() {
  const { signIn, switchRole, demoMode } = useAuth();
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(await signIn(username, password));
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex items-center space-x-3 mb-6">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-sky-600 text-white">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-900 dark:text-white">{t.common.appName}</h1>
            <p className="text-xs text-slate-500">{t.common.schoolName}</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t.auth.username}
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              required
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t.auth.password}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />
          </label>
          {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold disabled:opacity-60"
          >
            {t.auth.signIn}
          </button>
        </form>
        {demoMode && (
          <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2">
              {t.common.demoBadge}
            </p>
            <div className="flex flex-wrap gap-2">
              {DEMO_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => switchRole(r)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {t.roles[r]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
