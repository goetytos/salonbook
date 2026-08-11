"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import Sidebar from "@/components/dashboard/Sidebar";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { business, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !business) router.push("/auth/login");
  }, [loading, business, router]);

  if (loading) {
    return (
      <main id="main-content" className="min-h-screen bg-canvas px-4 py-10" aria-busy="true">
        <div className="mx-auto max-w-7xl">
          <div className="h-16 w-56 animate-pulse rounded-xl bg-dark-100 motion-reduce:animate-none" />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-2xl bg-dark-100 motion-reduce:animate-none" />
            ))}
          </div>
          <p className="sr-only" role="status">Loading business workspace</p>
        </div>
      </main>
    );
  }

  if (!business) return null;

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <Sidebar />
      <div className="min-w-0">
        {business.status === "pending" && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:px-6" role="status">
            <strong>Approval pending.</strong> Your business remains private until an administrator activates it.
          </div>
        )}
        {business.status === "suspended" && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 sm:px-6" role="alert">
            <strong>Business suspended.</strong> Customers cannot currently find or book your business. Contact support for help.
          </div>
        )}
        <main id="main-content" tabIndex={-1} className="px-4 pb-12 pt-7 outline-none sm:px-6 lg:px-8 lg:py-10">
          <div className="mx-auto w-full max-w-[92rem]">{children}</div>
        </main>
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
