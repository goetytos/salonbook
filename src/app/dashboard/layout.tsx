"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import Sidebar from "@/components/dashboard/Sidebar";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { business, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !business) {
      router.push("/auth/login");
    }
  }, [loading, business, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-50">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!business) return null;

  return (
    <div className="flex min-h-screen bg-dark-50">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">{children}</main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  );
}
