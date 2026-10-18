"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/i18n/context";
import { api, btnCls, cardCls, inputCls, smallBtn } from "./ui";

interface Row { id: string; username: string; fullName: string; role: string; active: boolean; mustChangePassword: boolean; classId: string | null; className: string | null }
interface Cls { id: string; name: string }
const ROLES = ["student", "teacher", "admin", "parent"] as const;

export function UsersModule() {
  const { t } = useI18n();
  const { user: me } = useAuth();
  const [users, setUsers] = useState<Row[]>([]);
  const [classes, setClasses] = useState<Cls[]>([]);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({ username: "", fullName: "", role: "student", classId: "", password: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [secret, setSecret] = useState<{ who: string; password: string } | null>(null);

  const load = useCallback(async () => {
    const [u, c] = await Promise.all([api<{ users: Row[] }>("/api/admin/users"), api<{ classes: Cls[] }>("/api/admin/classes")]);
    setUsers(u.data.users ?? []);
    setClasses(c.data.classes ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await api<{ temporaryPassword?: string; user: { fullName: string } }>("/api/admin/users", "POST", {
      ...form, classId: form.role === "student" ? form.classId : undefined, password: form.password || undefined,
    });
    if (!r.ok) return setMsg({ ok: false, text: r.data.error ?? "Error" });
    setMsg({ ok: true, text: t.admin.saved });
    setSecret(r.data.temporaryPassword ? { who: r.data.user.fullName, password: r.data.temporaryPassword } : null);
    setForm({ username: "", fullName: "", role: "student", classId: "", password: "" });
    load();
  };

  const patch = async (u: Row, body: object) => {
    const r = await api(`/api/admin/users/${u.id}`, "PATCH", body);
    setMsg(r.ok ? { ok: true, text: t.admin.saved } : { ok: false, text: r.data.error ?? "Error" });
    load();
  };

  const reset = async (u: Row) => {
    const r = await api<{ temporaryPassword?: string }>(`/api/admin/users/${u.id}/password`, "POST", {});
    if (!r.ok) return setMsg({ ok: false, text: r.data.error ?? "Error" });
    setSecret({ who: u.fullName, password: r.data.temporaryPassword ?? "" });
    load();
  };

  const shown = users.filter((u) => !filter || u.role === filter);

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t.admin.users}</h2>

      <form onSubmit={create} className={`${cardCls} p-4 grid gap-3 sm:grid-cols-6 items-end`}>
        <label className="text-xs font-semibold sm:col-span-2">{t.admin.fullName}
          <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={`${inputCls} w-full mt-1`} /></label>
        <label className="text-xs font-semibold">{t.admin.username}
          <input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoCapitalize="none" className={`${inputCls} w-full mt-1`} /></label>
        <label className="text-xs font-semibold">{t.admin.role}
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={`${inputCls} w-full mt-1`}>
            {ROLES.map((r) => <option key={r} value={r}>{t.roles[r]}</option>)}</select></label>
        {form.role === "student" && (
          <label className="text-xs font-semibold">{t.admin.class}
            <select required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} className={`${inputCls} w-full mt-1`}>
              <option value="">{t.admin.noClass}</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        )}
        <label className="text-xs font-semibold">{t.admin.password}
          <input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={`${inputCls} w-full mt-1`} /></label>
        <button type="submit" className={btnCls}>{t.admin.add}</button>
      </form>

      {msg && <p role="status" className={`text-xs ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>}
      {secret && (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm space-y-2">
          <p className="font-semibold">{secret.who}</p>
          <p className="text-xs">{t.admin.oneTime}</p>
          <p className="flex items-center gap-3"><code className="px-2 py-1 rounded bg-white dark:bg-slate-800 font-mono text-base select-all">{secret.password}</code>
            <button className={smallBtn} onClick={() => navigator.clipboard?.writeText(secret.password)}>{t.admin.copy}</button>
            <button className={smallBtn} onClick={() => setSecret(null)}>×</button></p>
        </div>
      )}

      <div className="flex gap-2 text-xs">
        {["", ...ROLES].map((r) => (
          <button key={r} onClick={() => setFilter(r)} className={`px-3 py-1 rounded-full border ${filter === r ? "bg-sky-600 text-white border-sky-600" : "border-slate-200 dark:border-slate-700"}`}>
            {r ? t.roles[r as (typeof ROLES)[number]] : "All"}</button>
        ))}
      </div>

      <div className={`${cardCls} overflow-x-auto`}>
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500"><tr>
            <th className="p-3">{t.admin.fullName}</th><th className="p-3">{t.admin.username}</th><th className="p-3">{t.admin.role}</th><th className="p-3">{t.admin.class}</th><th className="p-3" /></tr></thead>
          <tbody>
            {shown.map((u) => (
              <tr key={u.id} className={`border-t border-slate-100 dark:border-slate-800 ${u.active ? "" : "opacity-50"}`}>
                <td className="p-3">{u.fullName}{u.mustChangePassword && <span className="ml-2 text-amber-600">({t.admin.mustChange})</span>}</td>
                <td className="p-3 font-mono">{u.username}</td>
                <td className="p-3">
                  <select value={u.role} disabled={u.id === me?.id} onChange={(e) => patch(u, { role: e.target.value, ...(e.target.value === "student" && !u.classId && classes[0] ? { classId: classes[0].id } : {}) })} className={`${inputCls} py-1`}>
                    {ROLES.map((r) => <option key={r} value={r}>{t.roles[r]}</option>)}</select></td>
                <td className="p-3">{u.role === "student" ? (
                  <select value={u.classId ?? ""} onChange={(e) => patch(u, { classId: e.target.value })} className={`${inputCls} py-1`}>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>) : "–"}</td>
                <td className="p-3 whitespace-nowrap space-x-2 text-right">
                  <button className={smallBtn} onClick={() => reset(u)}>{t.admin.resetPassword}</button>
                  {u.id !== me?.id && (
                    <button className={smallBtn} onClick={() => (u.active ? confirm(t.admin.confirmDeactivate) && patch(u, { active: false }) : patch(u, { active: true }))}>
                      {u.active ? t.admin.deactivate : t.admin.activate}</button>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
