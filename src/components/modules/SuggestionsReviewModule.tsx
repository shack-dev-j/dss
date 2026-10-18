"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/i18n/context";
import { Badge } from "@/components/ui/Badge";
import { SuggestionStatus } from "@/types";
import {
  MessageSquareLock,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  Send,
  ShieldCheck,
  AlertCircle
} from "lucide-react";

export function SuggestionsReviewModule() {
  const { role } = useAuth();
  const { t } = useI18n();
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  // Disposition Form
  const [newStatus, setNewStatus] = useState<SuggestionStatus>("under_review");
  const [responseMsg, setResponseMsg] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const fetchSuggestions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/suggestions/review`);
      const data = await res.json();
      if (res.ok) {
        setSuggestions(data.suggestions || []);
        if (data.suggestions && data.suggestions.length > 0 && !selectedItem) {
          setSelectedItem(data.suggestions[0]);
          setNewStatus(data.suggestions[0].status);
          setResponseMsg(data.suggestions[0].officialResponse || "");
        }
      }
    } catch (err) {
      console.error("Error fetching suggestions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [role]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setIsUpdating(true);
    setSuccessMsg("");

    try {
      const res = await fetch("/api/suggestions/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedItem.id,
          status: newStatus,
          officialResponse: responseMsg,
          role,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("Murojaat holati muvaffaqiyatli yangilandi va javob e'lon qilindi!");
        setSelectedItem(data.suggestion);
        fetchSuggestions();
      }
    } catch (err) {
      console.error("Update error:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = (status: SuggestionStatus) => {
    const map: Record<SuggestionStatus, { label: string; variant: "default" | "success" | "warning" | "error" | "info" }> = {
      received: { label: t.suggestions.statuses.received, variant: "info" },
      under_review: { label: t.suggestions.statuses.under_review, variant: "warning" },
      approved: { label: t.suggestions.statuses.approved, variant: "success" },
      denied: { label: t.suggestions.statuses.denied, variant: "error" },
      in_progress: { label: t.suggestions.statuses.in_progress, variant: "default" },
      implemented: { label: t.suggestions.statuses.implemented, variant: "success" },
      closed: { label: t.suggestions.statuses.closed, variant: "default" },
    };
    const s = map[status] || { label: status, variant: "default" };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  if (role !== "admin") {
    return (
      <div className="p-8 text-center text-slate-500">
        Ushbu bo'lim faqat Maktab Direktori va Menejeri uchun ochiq.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Rahbariyat Ko'rib Chiqish Portali</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {t.suggestions.reviewTitle}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Muallif shaxsi tizimda mavjud emas. Takliflarga munosabat bildiring va holatni o'zgartiring.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Suggestion List */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Kelib tushgan murojaatlar ({suggestions.length})
            </span>
            <span className="text-[11px] text-slate-400">Kvitansiya bo'yicha</span>
          </div>

          {isLoading ? (
            <p className="text-xs text-slate-400 p-4">{t.common.loading}</p>
          ) : suggestions.length === 0 ? (
            <p className="text-xs text-slate-400 p-4">{t.common.noData}</p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {suggestions.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedItem(item);
                    setNewStatus(item.status);
                    setResponseMsg(item.officialResponse || "");
                    setSuccessMsg("");
                  }}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    selectedItem?.id === item.id
                      ? "border-sky-500 bg-sky-50/40 dark:bg-sky-950/20 shadow-sm"
                      : "border-slate-200 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-semibold text-[11px] text-sky-600 dark:text-sky-400">
                      {item.receiptCode}
                    </span>
                    {getStatusBadge(item.status)}
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white line-clamp-1 mb-1">
                    {item.title}
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400 line-clamp-2 text-[11px]">
                    {item.content}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="capitalize">{item.category}</span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Review & Response Form */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          {selectedItem ? (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <span className="text-[11px] font-mono font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded">
                    {selectedItem.receiptCode}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    {selectedItem.title}
                  </h3>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center space-x-2">
                    <span className="capitalize">Yo'nalish: <strong>{selectedItem.category}</strong></span>
                    <span>•</span>
                    <span>Yuborilgan sana: {new Date(selectedItem.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <div>{getStatusBadge(selectedItem.status)}</div>
              </div>

              {/* Suggestion Text */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                <span className="font-semibold text-slate-500 block mb-1">Murojaat to'liq matni:</span>
                {selectedItem.content}
              </div>

              {/* Update & Response Form */}
              <form onSubmit={handleUpdate} className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Munosabat bildirish va holatni yangilash
                </h4>

                {successMsg && (
                  <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Status Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Yangi holatni belgilash:
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e: any) => setNewStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    <option value="received">{t.suggestions.statuses.received}</option>
                    <option value="under_review">{t.suggestions.statuses.under_review}</option>
                    <option value="approved">{t.suggestions.statuses.approved} (Qabul qilindi va ma'qullandi)</option>
                    <option value="denied">{t.suggestions.statuses.denied} (Asosli rad etildi)</option>
                    <option value="in_progress">{t.suggestions.statuses.in_progress} (Ijro jarayonida)</option>
                    <option value="implemented">{t.suggestions.statuses.implemented} (Amalga oshirildi)</option>
                    <option value="closed">{t.suggestions.statuses.closed} (Yopildi)</option>
                  </select>
                </div>

                {/* Response Text */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Rasmiy tushuntirish yoki javob matni (Murojaatchiga ko'rinadi):
                  </label>
                  <textarea
                    rows={4}
                    value={responseMsg}
                    onChange={(e) => setResponseMsg(e.target.value)}
                    placeholder={t.suggestions.responsePlaceholder}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-slate-400 text-white font-semibold text-xs transition-colors shadow-sm"
                  >
                    <Send className={`w-3.5 h-3.5 ${isUpdating ? "animate-spin" : ""}`} />
                    <span>{isUpdating ? t.common.loading : t.suggestions.respondButton}</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
              <MessageSquareLock className="w-8 h-8 mb-2 stroke-1" />
              <span>Ko'rib chiqish uchun chap tarafdan murojaatni tanlang</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
