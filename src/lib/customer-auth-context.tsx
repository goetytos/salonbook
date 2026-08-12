"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import type { Customer } from "@/types";

interface CustomerAuthState {
  customer: Omit<Customer, "password_hash"> | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: { name: string; email: string; password: string; phone: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthState | null>(null);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Omit<Customer, "password_hash"> | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await customerApi.get<{ customer: Omit<Customer, "password_hash"> }>(
        "/customer/auth/me"
      );
      setCustomer(data.customer);
    } catch {
      setCustomer(null);
    }
  }, []);

  useEffect(() => {
    localStorage.removeItem("salonbook_customer_token");
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const data = await customerApi.post<{
      customer: Omit<Customer, "password_hash">;
    }>("/customer/auth/login", { email, password });
    setCustomer(data.customer);
  };

  const signup = async (formData: { name: string; email: string; password: string; phone: string }) => {
    const data = await customerApi.post<{
      customer: Omit<Customer, "password_hash">;
    }>("/customer/auth/signup", formData);
    setCustomer(data.customer);
  };

  const logout = async () => {
    try {
      await customerApi.post<{ success: boolean }>("/customer/auth/logout", {});
    } finally {
      setCustomer(null);
    }
  };

  return (
    <CustomerAuthContext.Provider value={{ customer, loading, login, signup, logout, refresh }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  return ctx;
}

// Customer API calls use the role-specific HttpOnly cookie.
const customerApi = {
  get: async <T,>(path: string): Promise<T> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    const res = await fetch(`/api${path}`, { headers, credentials: "same-origin" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res.json();
  },
  post: async <T,>(path: string, data: unknown): Promise<T> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    const res = await fetch(`/api${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
      credentials: "same-origin",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res.json();
  },
  patch: async <T,>(path: string, data: unknown): Promise<T> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    const res = await fetch(`/api${path}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(data),
      credentials: "same-origin",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res.json();
  },
};

export { customerApi };
