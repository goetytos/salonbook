"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { api } from "@/lib/api-client";
import type { Business, DashboardStats } from "@/types";

interface AuthState {
  business: Omit<Business, "password_hash"> | null;
  stats: DashboardStats | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: {
    name: string;
    email: string;
    password: string;
    phone: string;
    location: string;
    invitation_token: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [business, setBusiness] = useState<Omit<Business, "password_hash"> | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<{ business: Omit<Business, "password_hash">; stats: DashboardStats }>(
        "/auth/me"
      );
      setBusiness(data.business);
      setStats(data.stats);
    } catch {
      setBusiness(null);
      setStats(null);
    }
  }, []);

  useEffect(() => {
    // Old releases exposed bearer tokens to JavaScript. Remove any surviving
    // copy and validate the HttpOnly session cookie with the server instead.
    localStorage.removeItem("salonbook_token");
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const data = await api.post<{ business: Omit<Business, "password_hash"> }>(
      "/auth/login",
      { email, password }
    );
    setBusiness(data.business);
    await refresh();
  };

  const signup = async (formData: {
    name: string;
    email: string;
    password: string;
    phone: string;
    location: string;
    invitation_token: string;
  }) => {
    const data = await api.post<{ business: Omit<Business, "password_hash"> }>(
      "/auth/signup",
      formData
    );
    setBusiness(data.business);
    await refresh();
  };

  const logout = async () => {
    try {
      await api.post<{ success: boolean }>("/auth/logout", {});
    } finally {
      setBusiness(null);
      setStats(null);
    }
  };

  return (
    <AuthContext.Provider value={{ business, stats, loading, login, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
