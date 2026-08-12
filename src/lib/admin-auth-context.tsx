"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import type { Admin, PlatformStats } from "@/types";

const API_BASE = "/api/admin";

interface AdminAuthState {
  admin: Omit<Admin, "password_hash"> | null;
  stats: PlatformStats | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshStats: () => Promise<void>;
}

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Omit<Admin, "password_hash"> | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshStats = useCallback(async () => {
    try {
      const data = await adminFetch<PlatformStats>("/stats");
      setStats(data);
    } catch {
      // stats fetch failed, not critical
    }
  }, []);

  useEffect(() => {
    localStorage.removeItem("salonbook_admin_token");
    adminFetch<{ admin: Omit<Admin, "password_hash"> }>("/auth/me")
      .then(({ admin: currentAdmin }) => {
        setAdmin(currentAdmin);
        return refreshStats();
      })
      .catch(() => {
        setAdmin(null);
        setStats(null);
      })
      .finally(() => setLoading(false));
  }, [refreshStats]);

  const login = async (email: string, password: string) => {
    const data = await adminFetch<{ admin: Omit<Admin, "password_hash"> }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) }
    );
    setAdmin(data.admin);
    await refreshStats();
  };

  const logout = async () => {
    try {
      await adminFetch<{ success: boolean }>("/auth/logout", {
        method: "POST",
        body: JSON.stringify({}),
      });
    } finally {
      setAdmin(null);
      setStats(null);
    }
  };

  return (
    <AdminAuthContext.Provider value={{ admin, stats, loading, login, logout, refreshStats }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
