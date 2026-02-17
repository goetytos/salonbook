"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { api } from "@/lib/api-client";
import type { Customer } from "@/types";

interface CustomerAuthState {
  customer: Omit<Customer, "password_hash"> | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: { name: string; email: string; password: string; phone: string }) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthState | null>(null);

const TOKEN_KEY = "salonbook_customer_token";

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
      localStorage.removeItem(TOKEN_KEY);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      refresh().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const data = await customerApi.post<{
      token: string;
      customer: Omit<Customer, "password_hash">;
    }>("/customer/auth/login", { email, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    setCustomer(data.customer);
  };

  const signup = async (formData: { name: string; email: string; password: string; phone: string }) => {
    const data = await customerApi.post<{
      token: string;
      customer: Omit<Customer, "password_hash">;
    }>("/customer/auth/signup", formData);
    localStorage.setItem(TOKEN_KEY, data.token);
    setCustomer(data.customer);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setCustomer(null);
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

// Separate API client that uses the customer token
const customerApi = {
  get: async <T,>(path: string): Promise<T> => {
    const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`/api${path}`, { headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res.json();
  },
  post: async <T,>(path: string, data: unknown): Promise<T> => {
    const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`/api${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res.json();
  },
  patch: async <T,>(path: string, data: unknown): Promise<T> => {
    const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`/api${path}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res.json();
  },
};

export { customerApi };
