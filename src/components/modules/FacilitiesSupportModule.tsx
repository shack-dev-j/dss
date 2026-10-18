"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/i18n/context";
import { Badge } from "@/components/ui/Badge";
import { SupportTicket } from "@/types";
import {
  Wrench,
  Tv,
  Wifi,
  Plus,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle
} from "lucide-react";

export function FacilitiesSupportModule() {
  const { user, role } = useAuth();
  const { t } = useI18n();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [category, setCategory] = useState<"smartboard" | "it" | "facilities">("smartboard");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/tickets");
      const data = await res.json();
      if (res.ok) {
        setTickets(data.tickets || []);
      }
    } catch (err) {
      console.error("Tickets error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reporterName: `${user.fullName} (${user.role})`,
          category,
          title,
          description,
          priority,
        }),
      });

      if (res.ok) {
        setIsCreating(false);
        setTitle("");
        setDescription("");
        fetchTickets();
      }
    } catch (err) {
      console.error("Create ticket error:", err);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch("/api/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        fetchTickets();
      }
    } catch (err) {
      console.error("Status update error:", err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="warning">Yangi (Ochiq)</Badge>;
      case "in_progress":
        return <Badge variant="info">Jarayonda</Badge>;
      case "resolved":
        return <Badge variant="success">Hal qilindi</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 text-xs font-semibold mb-2">
            <Wrench className="w-3.5 h-3.5" />
            <span>IT va Moddiy Texnik Ta'minot</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {t.nav.facilities}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Smartboard, kompyuter va sinf jihozlaridagi nosozliklarni operativ bartaraf etish
          </p>
        </div>

        <button
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Yangi so'rov qoldirish</span>
        </button>
      </div>

      {/* Create Ticket Form */}
      {isCreating && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-sky-200 dark:border-sky-800 p-6 shadow-md animate-in fade-in space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Nosozlik yoki texnik muammo haqida xabar berish
          </h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Yo'nalish
                </label>
                <select
                  value={category}
                  onChange={(e: any) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="smartboard">Smartboard va Proyektor</option>
                  <option value="it">Kompyuter va Tarmoq (Wi-Fi)</option>
                  <option value="facilities">Sinf jihozlari va mebel</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Muhimlik darajasi
                </label>
                <select
                  value={priority}
                  onChange={(e: any) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="high">Yuqori (Dars to'xtab qolgan)</option>
                  <option value="medium">O'rta (Nosozlik mavjud)</option>
                  <option value="low">Past (Rejali ko'rik)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Qisqacha sarlavha (Xona raqami bilan)
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Masalan: 302-xona smartboardi HDMI ulanmayapti"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Batafsil tavsif
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Muammoni aniq tasvirlab bering..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              >
                {t.common.cancel}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-sm"
              >
                Yuborish
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tickets List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white">
          Aktiv texnik arizalar ({tickets.length})
        </h3>

        {isLoading ? (
          <p className="text-xs text-slate-400 p-4">{t.common.loading}</p>
        ) : (
          <div className="space-y-3">
            {tickets.map((tkt) => (
              <div
                key={tkt.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider text-[10px]">
                      {tkt.category}
                    </span>
                    <span>•</span>
                    <span className="text-slate-400 text-[11px]">{tkt.reporterName}</span>
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    {tkt.title}
                  </h4>
                  <p className="text-slate-600 dark:text-slate-300 text-xs">
                    {tkt.description}
                  </p>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  {getStatusBadge(tkt.status)}

                  {role === "admin" && (
                    <select
                      value={tkt.status}
                      onChange={(e) => handleStatusChange(tkt.id, e.target.value)}
                      className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold"
                    >
                      <option value="open">Ochiq</option>
                      <option value="in_progress">Jarayonda</option>
                      <option value="resolved">Hal qilindi</option>
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
