"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/i18n/context";
import { UserRole } from "@/types";
import {
  GraduationCap,
  Globe,
  Sun,
  Moon,
  RotateCcw,
  User,
  ChevronDown,
  ShieldCheck,
  Check,
  LogOut
} from "lucide-react";

export function Navbar() {
  const { user, role, switchRole, signOut, demoMode } = useAuth();
  const { locale, setLocale, t } = useI18n();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
    if (!isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleResetDemo = async () => {
    if (confirm(t.common.demoResetConfirm)) {
      setIsResetting(true);
      try {
        const res = await fetch("/api/demo/reset", { method: "POST" });
        if (res.ok) {
          alert(t.common.demoResetSuccess);
          window.location.reload();
        }
      } catch (err) {
        console.error("Reset error:", err);
      } finally {
        setIsResetting(false);
      }
    }
  };

  const rolesList: { id: UserRole; name: string }[] = [
    { id: "student", name: t.roles.student },
    { id: "teacher", name: t.roles.teacher },
    { id: "admin", name: t.roles.admin },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
      <div className="flex items-center justify-between h-16 px-4 md:px-6 max-w-7xl mx-auto">
        {/* Brand & Demo Pill */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-sky-600 text-white font-bold shadow-sm">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">
                NamPS OS
              </span>
              {demoMode && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  {t.common.demoBadge}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              {t.common.schoolName}
            </p>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Quick Role Switcher (demo mode only) */}
          {demoMode ? (
          <div className="relative">
            <button
              onClick={() => setRoleMenuOpen(!roleMenuOpen)}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors text-xs font-medium text-slate-800 dark:text-slate-200"
            >
              <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>{t.common.role}: <strong>{t.roles[role]}</strong></span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {roleMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-1">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {t.common.switchRole}
                </div>
                {rolesList.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      switchRole(r.id);
                      setRoleMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 ${
                      role === r.id ? "text-sky-600 dark:text-sky-400 bg-sky-50/50 dark:bg-sky-950/20" : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span>{r.name}</span>
                    {role === r.id && <Check className="w-4 h-4 text-sky-600 dark:text-sky-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          ) : null}

          {/* Language Switcher */}
          <button
            onClick={() => setLocale(locale === "uz" ? "en" : "uz")}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
            title="O'zbekcha / English"
          >
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            <span>{locale === "uz" ? "O'ZB" : "ENG"}</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            title={t.common.theme}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Reset Demo State Button (demo mode, admin only) */}
          {demoMode && role === "admin" && (
          <button
            onClick={handleResetDemo}
            disabled={isResetting}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-xs font-medium transition-colors"
            title={t.common.resetDemo}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">{t.common.resetDemo}</span>
          </button>
          )}

          <button
            onClick={() => signOut()}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t.auth.signOut}</span>
          </button>

          {/* User Avatar */}
          <div className="flex items-center space-x-2 pl-1 border-l border-slate-200 dark:border-slate-700">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 text-xs font-bold">
              {user?.fullName.charAt(0) || <User className="w-4 h-4" />}
            </div>
            <div className="hidden lg:block text-left text-xs leading-tight">
              <p className="font-semibold text-slate-900 dark:text-white truncate max-w-[120px]">
                {user?.fullName}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                {t.roles[role]}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
