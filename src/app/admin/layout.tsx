"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AdminAuthProvider, useAdminAuth } from "@/lib/admin-auth-context";
import BrandMark from "@/components/brand/BrandMark";

function AdminShell({ children }: { children: React.ReactNode }) {
  const { admin, loading, logout } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !admin && pathname !== "/admin/login") router.push("/admin/login");
  }, [loading, admin, pathname, router]);

  if (loading) {
    return (
      <main id="main-content" className="studio-grid flex min-h-dvh items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-md space-y-3" role="status" aria-label="Loading administrator workspace">
          <div className="h-16 animate-pulse rounded-2xl bg-dark-100 motion-reduce:animate-none" />
          <div className="h-36 animate-pulse rounded-2xl bg-dark-100 motion-reduce:animate-none" />
          <span className="sr-only">Loading administrator workspace</span>
        </div>
      </main>
    );
  }

  if (pathname === "/admin/login") return <>{children}</>;

  if (!admin) {
    return (
      <main id="main-content" className="flex min-h-dvh items-center justify-center bg-canvas" role="status">
        <p className="text-sm text-dark-500">Opening administrator sign in…</p>
      </main>
    );
  }

  const handleLogout = () => {
    logout();
    router.push("/admin/login");
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-primary-900 text-white shadow-[0_12px_40px_rgba(16,43,36,0.15)]">
        <nav className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8" aria-label="Administrator navigation">
          <Link href="/admin" className="flex min-w-0 items-center gap-3 rounded-lg" aria-label="SalonBook administrator dashboard">
            <BrandMark inverse compact />
            <span className="min-w-0">
              <span className="block truncate font-display text-lg font-semibold">SalonBook</span>
              <span className="block text-[0.62rem] font-bold uppercase tracking-[0.18em] text-primary-200">Platform admin</span>
            </span>
          </Link>
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <span className="hidden max-w-56 truncate text-xs text-primary-200 sm:block">{admin.email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex min-h-11 items-center rounded-lg border border-white/15 px-3 text-sm font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Sign out
            </button>
          </div>
        </nav>
      </header>
      <main id="main-content" className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">{children}</main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthProvider><AdminShell>{children}</AdminShell></AdminAuthProvider>;
}
