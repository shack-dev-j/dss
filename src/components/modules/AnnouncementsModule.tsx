"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/i18n/context";
import { Badge } from "@/components/ui/Badge";
import { AnnouncementItem } from "@/types";
import {
  Bell,
  AlertCircle,
  Calendar,
  User,
  Plus,
  Send,
  Sparkles
} from "lucide-react";

export function AnnouncementsModule() {
  const { user, role } = useAuth();
  const { t } = useI18n();

  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<"urgent" | "normal" | "info">("normal");
  const [targetAudience, setTargetAudience] = useState<"all" | "staff" | "class" | "students">("all");

  const fetchAnnouncements = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/announcements");
      const data = await res.json();
      if (res.ok) {
        setAnnouncements(data.announcements || []);
      }
    } catch (err) {
      console.error("Announcements fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          authorName: `${user.fullName} (${t.roles[role]})`,
          priority,
          targetAudience,
        }),
      });

      if (res.ok) {
        setIsCreating(false);
        setTitle("");
        setContent("");
        fetchAnnouncements();
      }
    } catch (err) {
      console.error("Create announcement error:", err);
    }
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "urgent":
        return <Badge variant="error">Shoshilinch</Badge>;
      case "normal":
        return <Badge variant="default">Muhim</Badge>;
      default:
        return <Badge variant="neutral">Ma'lumot</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 text-xs font-semibold mb-2">
            <Bell className="w-3.5 h-3.5" />
            <span>Rasmiy Bildirishnomalar</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {t.nav.announcements}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Maktab ma'muriyati va o'qituvchilarning rasmiy e'lon va yangiliklari
          </p>
        </div>

        {(role === "admin" || role === "teacher") && (
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs transition-colors shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Yangi e'lon berish</span>
          </button>
        )}
      </div>

      {/* Create Announcement Form */}
      {isCreating && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-sky-200 dark:border-sky-800 p-6 shadow-md animate-in fade-in space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Rasmiy e'lon joylashtirish
          </h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Muhimlik darajasi
                </label>
                <select
                  value={priority}
                  onChange={(e: any) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="urgent">Shoshilinch (Qizil belgi)</option>
                  <option value="normal">Muhim (Standart)</option>
                  <option value="info">Ma'lumot uchun</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kimlar uchun mo'ljallangan?
                </label>
                <select
                  value={targetAudience}
                  onChange={(e: any) => setTargetAudience(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="all">Barcha uchun (Maktab bo'ylab)</option>
                  <option value="students">Faqat o'quvchilar</option>
                  <option value="staff">Faqat o'qituvchilar va xodimlar</option>
                  <option value="class">Muayyan sinf</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                E'lon mavzusi
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="E'lon sarlavhasi..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                To'liq matn
              </label>
              <textarea
                rows={4}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="E'lon mazmunini yozing..."
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
                Joylashtirish
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Announcements Feed */}
      <div className="space-y-4">
        {isLoading ? (
          <p className="text-xs text-slate-400 p-8 text-center">{t.common.loading}</p>
        ) : announcements.length === 0 ? (
          <p className="text-xs text-slate-400 p-8 text-center">{t.common.noData}</p>
        ) : (
          announcements.map((ann) => (
            <div
              key={ann.id}
              className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3 hover:border-sky-300 dark:hover:border-sky-700 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {getPriorityBadge(ann.priority)}
                  <span className="text-[11px] text-slate-400 capitalize">
                    Auditoriya: {ann.targetAudience === "all" ? "Barcha" : ann.targetAudience}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{new Date(ann.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {ann.title}
              </h3>

              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {ann.content}
              </p>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center space-x-2 text-[11px] text-slate-500">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>E'lon muallifi: <strong>{ann.authorName}</strong></span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
