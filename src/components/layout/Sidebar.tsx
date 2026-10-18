"use client";

import React from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/i18n/context";
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  CheckSquare,
  Clock,
  ClipboardList,
  Bell,
  FileText,
  MessageSquareLock,
  Sparkles,
  Users,
  FolderGit2,
  HelpCircle,
  Wrench,
  BarChart3,
  UserCog,
  UploadCloud,
  Layers,
  HeartHandshake
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const { role, hasTab } = useAuth();
  const { t } = useI18n();

  // Role-specific navigation definitions
  const getNavItems = () => {
    switch (role) {
      case "student":
        return [
          { id: "dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
          { id: "timetable", label: t.nav.timetable, icon: CalendarDays },
          { id: "assignments", label: t.nav.assignments, icon: CheckSquare },
          { id: "workload", label: t.nav.workload, icon: Clock },
          { id: "attendance", label: t.nav.attendance, icon: ClipboardList },
          { id: "suggestions", label: t.nav.anonymousSuggestion, icon: MessageSquareLock },
          { id: "announcements", label: t.nav.announcements, icon: Bell },
          { id: "events", label: t.nav.events, icon: Sparkles },
          { id: "projects", label: t.nav.projects, icon: FolderGit2 },
          { id: "policies", label: t.nav.knowledgeBase, icon: FileText },
          { id: "facilities", label: t.nav.facilities, icon: Wrench },
        ];

      case "teacher":
        return [
          { id: "dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
          { id: "timetable", label: "O'qitish jadvali", icon: CalendarDays },
          { id: "assignments", label: "Vazifalar va baholash", icon: CheckSquare },
          { id: "attendance", label: "Davomat daftari", icon: ClipboardList },
          { id: "workload", label: t.nav.workload, icon: Clock },
          { id: "announcements", label: t.nav.announcements, icon: Bell },
          { id: "policies", label: t.nav.knowledgeBase, icon: FileText },
        ];

      case "admin":
        return [
          { id: "dashboard", label: "Administrator paneli", icon: LayoutDashboard },
          { id: "suggestions-review", label: "Anonim takliflar (Ko'rib chiqish)", icon: MessageSquareLock },
          { id: "users", label: t.nav.userManagement, icon: UserCog },
          { id: "analytics", label: t.nav.analytics, icon: BarChart3 },
          { id: "csv-import", label: t.common.importCsv + " (Maktab ko'chirish)", icon: UploadCloud },
          { id: "timetable", label: "Dars jadvallarini boshqarish", icon: CalendarDays },
          { id: "announcements", label: t.nav.announcements, icon: Bell },
          { id: "policies", label: t.nav.knowledgeBase, icon: FileText },
          { id: "facilities", label: t.nav.facilities, icon: Wrench },
        ];

      case "parent":
        return [
          { id: "guardian", label: t.guardian.title, icon: HeartHandshake },
          { id: "timetable", label: "Farzand dars jadvali", icon: CalendarDays },
          { id: "assignments", label: "Topshiriqlar va baholar", icon: CheckSquare },
          { id: "attendance", label: "Davomat hisoboti", icon: ClipboardList },
          { id: "announcements", label: t.nav.announcements, icon: Bell },
          { id: "policies", label: t.nav.knowledgeBase, icon: FileText },
        ];

      default:
        return [
          { id: "dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
          { id: "announcements", label: t.nav.announcements, icon: Bell },
        ];
    }
  };

  const navItems = [...getNavItems(), { id: "account", label: t.auth.account, icon: UserCog }].filter((item) => hasTab(item.id));

  return (
    <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between hidden md:flex">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          {t.roles[role]} bo'limi
        </div>
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-semibold shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-sky-600 dark:text-sky-400" : "text-slate-400"}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Anonymous Suggestions Highlight Pill */}
      {hasTab("suggestions") ? (
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs">
        <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-200 font-semibold">
          <MessageSquareLock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Maxfiy Murojaat</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
          Shaxsingiz to'liq sir saqlanadi. Kvitansiya kodi bilan javobni tekshiring.
        </p>
        <button
          onClick={() => setActiveTab("suggestions")}
          className="mt-2 text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center space-x-1"
        >
          <span>Anonim taklif yuborish &rarr;</span>
        </button>
      </div>
      ) : <div />}
    </aside>
  );
}
