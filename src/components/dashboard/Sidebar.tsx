"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandMark from "@/components/brand/BrandMark";
import { useAuth } from "@/lib/auth-context";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const iconClass = "h-[1.15rem] w-[1.15rem]";

const scheduleItems: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-12h6V4h-6v4Z" strokeWidth="1.7" strokeLinejoin="round" /></svg> },
  { label: "Bookings", href: "/dashboard/bookings", icon: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" strokeWidth="1.7" /><path d="M8 3v4m8-4v4M3 10h18" strokeWidth="1.7" strokeLinecap="round" /></svg> },
  { label: "Blocked dates", href: "/dashboard/blocked-dates", icon: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="9" strokeWidth="1.7" /><path d="m7 7 10 10" strokeWidth="1.7" strokeLinecap="round" /></svg> },
];

const workspaceItems: NavItem[] = [
  { label: "Services", href: "/dashboard/services", icon: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M6 4h12v16H6zM9 8h6m-6 4h6m-6 4h4" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg> },
  { label: "Staff", href: "/dashboard/staff", icon: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="9" cy="8" r="3" strokeWidth="1.7" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M16 14a5 5 0 0 1 4.5 5" strokeWidth="1.7" strokeLinecap="round" /></svg> },
  { label: "Customers", href: "/dashboard/customers", icon: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="9" cy="8" r="3" strokeWidth="1.7" /><circle cx="17" cy="9" r="2.5" strokeWidth="1.7" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M14 15.2a4.7 4.7 0 0 1 6.5 3.8" strokeWidth="1.7" strokeLinecap="round" /></svg> },
];

const growthItems: NavItem[] = [
  { label: "Reviews", href: "/dashboard/reviews", icon: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m12 3 2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6-4.4-4.2 6-.9L12 3Z" strokeWidth="1.7" strokeLinejoin="round" /></svg> },
  { label: "Promotions", href: "/dashboard/promotions", icon: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m4 12 8-8h7v7l-8 8-7-7Z" strokeWidth="1.7" strokeLinejoin="round" /><circle cx="16" cy="7" r="1" fill="currentColor" /></svg> },
  { label: "Analytics", href: "/dashboard/analytics", icon: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M5 20V10m7 10V4m7 16v-7" strokeWidth="1.8" strokeLinecap="round" /></svg> },
  { label: "Settings", href: "/dashboard/settings", icon: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="3" strokeWidth="1.7" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" strokeWidth="1.25" strokeLinejoin="round" /></svg> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { business, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLElement>("button, a[href]")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  const isActive = (href: string) => href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const renderItems = (items: NavItem[]) => items.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      aria-current={isActive(item.href) ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors ${
        isActive(item.href)
          ? "bg-white text-primary-900 shadow-sm"
          : "text-primary-100 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className={isActive(item.href) ? "text-primary-700" : "text-primary-300"}>{item.icon}</span>
      {item.label}
    </Link>
  ));

  const navigation = (
    <>
      <div className="flex min-h-18 items-center justify-between border-b border-white/10 px-5">
        <Link href="/dashboard" aria-label="SalonBook dashboard" className="rounded-lg"><BrandMark inverse /></Link>
        <button type="button" onClick={() => { setMobileOpen(false); menuButtonRef.current?.focus(); }} aria-label="Close navigation" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-primary-200 hover:bg-white/10 hover:text-white lg:hidden">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Business workspace">
        <p className="px-3 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-primary-200">Schedule</p>
        <div className="mt-2 space-y-1">{renderItems(scheduleItems)}</div>
        <p className="mt-6 px-3 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-primary-200">Workspace</p>
        <div className="mt-2 space-y-1">{renderItems(workspaceItems)}</div>
        <p className="mt-6 px-3 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-primary-200">Growth</p>
        <div className="mt-2 space-y-1">{renderItems(growthItems)}</div>
      </nav>

      <div className="border-t border-white/10 p-4">
        {business && (
          <div className="rounded-xl bg-white/8 p-3">
            <p className="truncate text-sm font-semibold text-white">{business.name}</p>
            <Link href={`/book/${business.slug}`} target="_blank" className="mt-1 inline-flex min-h-8 items-center text-xs font-semibold text-primary-300 hover:text-white hover:underline">
              View booking page <span className="ml-1" aria-hidden="true">↗</span>
            </Link>
          </div>
        )}
        <button type="button" onClick={logout} className="mt-2 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-primary-200 hover:bg-white/10 hover:text-white">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M10 17l5-5-5-5m5 5H3m12-8h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-dark-200 bg-surface/95 px-4 backdrop-blur-xl lg:hidden">
        <button ref={menuButtonRef} type="button" onClick={() => setMobileOpen(true)} aria-expanded={mobileOpen} aria-controls="dashboard-mobile-navigation" aria-label="Open dashboard navigation" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-dark-200 bg-surface text-dark-800">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
        <BrandMark compact />
        <span className="max-w-[45vw] truncate text-xs font-bold text-dark-600">{business?.name}</span>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close navigation" onClick={() => { setMobileOpen(false); menuButtonRef.current?.focus(); }} className="absolute inset-0 h-full w-full bg-dark-900/50 backdrop-blur-sm" />
          <aside ref={drawerRef} id="dashboard-mobile-navigation" role="dialog" aria-modal="true" aria-label="Dashboard navigation" className="relative flex h-full w-[min(18rem,86vw)] flex-col bg-primary-900 shadow-2xl">
            {navigation}
          </aside>
        </div>
      )}

      <aside className="sticky top-0 hidden h-screen flex-col overflow-hidden bg-primary-900 lg:flex">{navigation}</aside>
    </>
  );
}
