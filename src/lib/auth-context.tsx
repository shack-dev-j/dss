"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { UserSession, UserRole } from "@/types";
import { TAB_FEATURE } from "@/lib/features";

interface AuthContextType {
  user: UserSession | null;
  role: UserRole;
  isLoading: boolean;
  demoMode: boolean;
  features: string[];
  /** True if the tab/module is available (its FEATURES flag is on, or it has none). */
  hasTab: (tab: string) => boolean;
  signIn: (username: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Demo mode only: start a real server session as the seeded demo user of that role. */
  switchRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [features, setFeatures] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setDemoMode(!!data.demoMode);
      if (res.ok) {
        setUser(data.user);
        setFeatures(data.features || []);
      } else {
        setUser(null);
        setFeatures([]);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = async (username: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return (data.error as string) || "Login failed";
    }
    await refresh();
    return null;
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setFeatures([]);
  };

  const switchRole = async (newRole: UserRole) => {
    await fetch("/api/auth/demo-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    await refresh();
  };

  const hasTab = (tab: string) => {
    const feature = TAB_FEATURE[tab];
    return !feature || features.includes(feature);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user ? user.role : "student",
        isLoading,
        demoMode,
        features,
        hasTab,
        signIn,
        signOut,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
