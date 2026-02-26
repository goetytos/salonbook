"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import type { Admin, PlatformStats } from "@/types";

const API_BASE = "/api/admin";
const TOKEN_KEY = "salonbook_admin_token";

interface AdminAuthState {
  admin: Omit<Admin, "password_hash"> | null;
  stats: PlatformStats | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshStats: () => Promise<void>;
}

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
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

  // On mount, check if token exists and validate by fetching stats
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      // Decode the JWT payload to get admin info (no verification, just display)
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setAdmin({ id: payload.id, email: payload.email, name: payload.email, created_at: "" });
        refreshStats().finally(() => setLoading(false));
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [refreshStats]);

  const login = async (email: string, password: string) => {
    const data = await adminFetch<{ token: string; admin: Omit<Admin, "password_hash"> }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) }
    );
    localStorage.setItem(TOKEN_KEY, data.token);
    setAdmin(data.admin);
    await refreshStats();
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setAdmin(null);
    setStats(null);
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
