"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin-auth-context";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card, { CardContent, CardHeader } from "@/components/ui/Card";
import DashboardState from "@/components/dashboard/DashboardState";
import PageHeader from "@/components/dashboard/PageHeader";

interface BusinessRow {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  location: string;
  category: string | null;
  status: string;
  created_at: string;
  booking_count: number;
  customer_count: number;
}

type StatusFilter = "" | "pending" | "active" | "suspended";

function adminFetchWithToken<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("salonbook_admin_token") : null;
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(options.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`/api/admin${path}`, { ...options, headers }).then(async (response) => {
    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: "Request failed" }));
      throw new Error(body.error || `HTTP ${response.status}`);
    }
    return response.json();
  });
}

export default function AdminDashboard() {
  const { stats, refreshStats } = useAdminAuth();
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchBusinesses = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const params = filter ? `?status=${filter}` : "";
      const data = await adminFetchWithToken<BusinessRow[]>(`/businesses${params}`);
      setBusinesses(data);
    } catch (requestError) {
      setBusinesses([]);
      setError(requestError instanceof Error ? requestError.message : "Businesses could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void fetchBusinesses();
  }, [fetchBusinesses]);

  const updateStatus = async (businessId: string, status: string) => {
    setUpdating(businessId);
    setActionError("");
    try {
      await adminFetchWithToken(`/businesses/${businessId}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await Promise.all([fetchBusinesses(false), refreshStats()]);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "The business status could not be updated.");
    } finally {
      setUpdating(null);
    }
  };

  const statCards = [
    { label: "Businesses", value: stats?.total_businesses ?? "—", detail: "All registered accounts", className: "border-primary-300 bg-primary-900 text-white" },
    { label: "Pending", value: stats?.pending_businesses ?? "—", detail: "Awaiting review", className: "border-amber-200 bg-amber-50 text-amber-900" },
    { label: "Active", value: stats?.active_businesses ?? "—", detail: "Currently available", className: "border-green-200 bg-green-50 text-green-900" },
    { label: "Suspended", value: stats?.suspended_businesses ?? "—", detail: "Access restricted", className: "border-red-200 bg-red-50 text-red-900" },
    { label: "Bookings", value: stats?.total_bookings ?? "—", detail: "Platform total", className: "border-dark-200 bg-surface text-dark-900" },
    { label: "Revenue", value: stats?.total_revenue != null ? `KES ${Number(stats.total_revenue).toLocaleString()}` : "—", detail: "Platform total", className: "border-accent-300 bg-accent-50 text-dark-900" },
  ];

  const statusVariant = (status: string) => status === "active" ? "success" as const : status === "pending" ? "warning" as const : status === "suspended" ? "danger" as const : "default" as const;
  const formatDate = (value: string) => new Date(value).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div>
      <PageHeader eyebrow="Platform operations" title="Business access" description="Review account status and monitor the activity moving through SalonBook." />

      <section className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Platform totals">
        {statCards.map((card, index) => (
          <div key={card.label} className={`rounded-2xl border p-4 ${card.className} ${index === 5 ? "col-span-2 md:col-span-1" : ""}`}>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.13em] opacity-70">{card.label}</p>
            <p className="mt-3 font-display text-2xl font-semibold tabular-nums tracking-[-0.035em]">{card.value}</p>
            <p className="mt-1 text-xs opacity-70">{card.detail}</p>
          </div>
        ))}
      </section>

      {actionError && <div className="mb-5"><DashboardState type="error" title="The account status was not changed" description={actionError} /></div>}

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-dark-900">Business directory</h2>
            <p className="mt-1 text-xs text-dark-500">Filter registrations before making an access decision.</p>
          </div>
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-dark-50 p-1" role="group" aria-label="Filter businesses by status">
            {(["", "pending", "active", "suspended"] as StatusFilter[]).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={filter === option}
                onClick={() => setFilter(option)}
                className={`min-h-11 shrink-0 rounded-lg px-3 text-sm font-bold capitalize transition-colors ${filter === option ? "bg-primary-900 text-white" : "text-dark-500 hover:bg-white hover:text-dark-800"}`}
              >
                {option || "All"}
              </button>
            ))}
          </div>
        </CardHeader>

        {loading ? (
          <CardContent><DashboardState type="loading" title="Loading businesses" /></CardContent>
        ) : error ? (
          <CardContent><DashboardState type="error" title="Business directory unavailable" description={error} onRetry={() => void fetchBusinesses()} /></CardContent>
        ) : businesses.length === 0 ? (
          <CardContent><DashboardState title={`No ${filter || "matching"} businesses`} description="Try another status filter or check again after new registrations arrive." /></CardContent>
        ) : (
          <>
            <div className="divide-y divide-dark-200 md:hidden">
              {businesses.map((business) => {
                const busy = updating === business.id;
                return (
                  <article key={business.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-dark-900">{business.name}</h3>
                        <p className="mt-1 truncate text-sm text-dark-500">{business.email}</p>
                        <p className="mt-1 text-xs text-dark-500">{business.location} · Joined {formatDate(business.created_at)}</p>
                      </div>
                      <Badge variant={statusVariant(business.status)}>{business.status}</Badge>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-dark-50 p-3 text-sm">
                      <div><dt className="text-xs text-dark-500">Bookings</dt><dd className="mt-1 font-bold tabular-nums text-dark-900">{business.booking_count}</dd></div>
                      <div><dt className="text-xs text-dark-500">Customers</dt><dd className="mt-1 font-bold tabular-nums text-dark-900">{business.customer_count}</dd></div>
                    </dl>
                    <div className="mt-4 flex flex-wrap gap-2" aria-busy={busy || undefined}>
                      {business.status !== "active" && <Button size="sm" disabled={busy} onClick={() => void updateStatus(business.id, "active")}>Activate</Button>}
                      {business.status !== "suspended" && <Button size="sm" variant="danger" disabled={busy} onClick={() => void updateStatus(business.id, "suspended")}>Suspend</Button>}
                      {busy && <span className="self-center text-xs text-dark-500" role="status">Updating…</span>}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <caption className="sr-only">SalonBook business accounts</caption>
                <thead><tr className="border-b border-dark-200 bg-dark-50">
                  {['Business', 'Location', 'Status', 'Bookings', 'Customers', 'Joined'].map((heading) => <th key={heading} scope="col" className="px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.1em] text-dark-500">{heading}</th>)}
                  <th scope="col" className="px-5 py-3 text-right text-xs font-bold uppercase tracking-[0.1em] text-dark-500">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-dark-200">
                  {businesses.map((business) => {
                    const busy = updating === business.id;
                    return (
                      <tr key={business.id} className="hover:bg-dark-50/70">
                        <td className="px-5 py-4"><p className="font-semibold text-dark-900">{business.name}</p><p className="mt-1 text-xs text-dark-500">{business.email} · {business.phone}</p></td>
                        <td className="px-5 py-4 text-dark-700">{business.location}<span className="mt-1 block text-xs capitalize text-dark-400">{business.category?.replace("-", " ") || "Uncategorised"}</span></td>
                        <td className="px-5 py-4"><Badge variant={statusVariant(business.status)}>{business.status}</Badge></td>
                        <td className="px-5 py-4 font-semibold tabular-nums text-dark-700">{business.booking_count}</td>
                        <td className="px-5 py-4 font-semibold tabular-nums text-dark-700">{business.customer_count}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-dark-500">{formatDate(business.created_at)}</td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2" aria-busy={busy || undefined}>
                            {business.status !== "active" && <Button size="sm" disabled={busy} onClick={() => void updateStatus(business.id, "active")}>Activate</Button>}
                            {business.status !== "suspended" && <Button size="sm" variant="danger" disabled={busy} onClick={() => void updateStatus(business.id, "suspended")}>Suspend</Button>}
                            {busy && <span className="sr-only" role="status">Updating {business.name}</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
