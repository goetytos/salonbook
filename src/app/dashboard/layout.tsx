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
      <div className="flex-1 flex flex-col overflow-auto">
        {business.status === "pending" && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 text-sm text-amber-800">
            <strong>Pending Approval:</strong> Your business is awaiting admin approval. It won&apos;t appear in public listings until activated.
          </div>
        )}
        {business.status === "suspended" && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-3 text-sm text-red-800">
            <strong>Suspended:</strong> Your business has been suspended and is not visible to customers. Please contact support.
          </div>
        )}
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
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
