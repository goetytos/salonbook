"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandMark from "@/components/brand/BrandMark";

export default function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [mobileOpen]);

  const isExplore = pathname === "/explore";

  return (
    <header className="sticky top-0 z-40 border-b border-dark-200 bg-surface/90 shadow-[0_12px_40px_rgba(28,37,31,0.06)] backdrop-blur-xl">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="Primary navigation">
        <div className="flex min-h-18 items-center justify-between gap-4">
          <Link href="/" aria-label="SalonBook home" className="shrink-0 rounded-lg">
            <BrandMark />
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            <Link
              href="/explore"
              aria-current={isExplore ? "page" : undefined}
              className={`text-sm font-semibold transition-colors ${
                isExplore ? "text-primary-700" : "text-dark-600 hover:text-dark-900"
              }`}
            >
              Find a salon
            </Link>
            <Link href="/auth/signup" className="text-sm font-semibold text-dark-600 transition-colors hover:text-dark-900">
              For businesses
            </Link>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Link href="/auth/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-dark-600 hover:bg-dark-50 hover:text-dark-900">
              Business sign in
            </Link>
            <Link href="/explore" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-700">
              Book a salon
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-dark-200 bg-surface text-dark-800 transition-colors hover:bg-dark-50 md:hidden"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              {mobileOpen ? (
                <path d="M6 6l12 12M18 6 6 18" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" strokeWidth="2" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>

        {mobileOpen && (
          <div id="mobile-navigation" className="border-t border-dark-200 pb-4 pt-3 md:hidden">
            <div className="grid gap-1">
              <Link href="/explore" className="rounded-lg px-3 py-3 text-sm font-semibold text-dark-800 hover:bg-dark-50">
                Find a salon
              </Link>
              <Link href="/auth/signup" className="rounded-lg bg-primary-900 px-3 py-3 text-center text-sm font-semibold text-white hover:bg-primary-700">
                List your business
              </Link>
              <Link href="/auth/login" className="rounded-lg px-3 py-3 text-center text-sm font-semibold text-dark-600 hover:bg-dark-50">
                Business sign in
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
