"use client";

import React, { useEffect, useState } from "react";
import { useI18n } from "@/i18n/context";

interface Row { id: string; username: string; fullName: string; role: string; active: boolean }

export function UsersModule() {
  const { t } = useI18n();
  const [users, setUsers] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users").then((r) => (r.ok ? r.json() : { users: [] })).then((d) => setUsers(d.users));
  }, []);

  const reset = async (u: Row) => {
    const pw = window.prompt(`${t.auth.newPassword} — ${u.fullName} (min 8)`);
    if (!pw) return;
    const res = await fetch(`/api/admin/users/${u.id}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: pw }),
    });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? `${u.username}: ${t.auth.passwordChanged}` : data.error || "Error");
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t.nav.userManagement}</h2>
      {msg && <p role="status" className="text-xs text-slate-600 dark:text-slate-300">{msg}</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500">
            <tr><th className="p-3">{t.auth.username}</th><th className="p-3">Name</th><th className="p-3">Role</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="p-3 font-mono">{u.username}</td>
                <td className="p-3">{u.fullName}</td>
                <td className="p-3">{u.role}</td>
                <td className="p-3 text-right">
                  <button onClick={() => reset(u)} className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                    {t.auth.resetPassword}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
