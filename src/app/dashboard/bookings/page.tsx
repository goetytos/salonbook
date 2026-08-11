"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Tabs from "@/components/ui/Tabs";
import CalendarView from "@/components/dashboard/CalendarView";
import DashboardState from "@/components/dashboard/DashboardState";
import PageHeader from "@/components/dashboard/PageHeader";
import type { Booking, BookingStatus } from "@/types";

export default function BookingsPage() {
  const { business } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [view, setView] = useState("list");
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (dateFilter) params.set("date", dateFilter);
      if (statusFilter) params.set("status", statusFilter);
      const query = params.toString();
      const data = await api.get<Booking[]>(`/businesses/${business.id}/bookings${query ? `?${query}` : ""}`);
      setBookings(data);
    } catch (requestError) {
      setBookings([]);
      setError(requestError instanceof Error ? requestError.message : "Bookings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [business, dateFilter, statusFilter]);

  useEffect(() => {
    void fetchBookings();
  }, [fetchBookings]);

  const updateStatus = async (bookingId: string, status: BookingStatus) => {
    if (!business) return;
    setUpdating(bookingId);
    setError("");
    try {
      await api.patch(`/businesses/${business.id}/bookings/${bookingId}`, { status });
      await fetchBookings();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The booking status could not be updated.");
    } finally {
      setUpdating(null);
    }
  };

  const badgeVariant = (status: string) => {
    if (status === "Booked") return "success" as const;
    if (status === "Cancelled" || status === "No-Show") return "danger" as const;
    return "default" as const;
  };

  const formatDate = (date: string) => new Date(date + (date.includes("T") ? "" : "T00:00:00")).toLocaleDateString("en-KE", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const actionsFor = (booking: Booking) => {
    if (booking.status !== "Booked") return null;
    const busy = updating === booking.id;

    return (
      <div className="flex flex-wrap gap-2" aria-busy={busy || undefined}>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => updateStatus(booking.id, "Completed")}>Complete</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => updateStatus(booking.id, "No-Show")}>No-show</Button>
        <Button size="sm" variant="danger" disabled={busy} onClick={() => updateStatus(booking.id, "Cancelled")}>Cancel</Button>
        {busy && <span className="self-center text-xs text-dark-500" role="status">Updating…</span>}
      </div>
    );
  };

  return (
    <div>
      <PageHeader eyebrow="Schedule" title="Bookings" description="Review appointments, filter the list and keep every visit’s status current." />

      <div className="mb-6 overflow-hidden rounded-xl border border-dark-200 bg-surface px-2">
        <Tabs ariaLabel="Booking view" tabs={[{ id: "list", label: "Appointment list" }, { id: "calendar", label: "Weekly calendar" }]} activeTab={view} onChange={setView} />
      </div>

      {view === "calendar" ? (
        <CalendarView />
      ) : (
        <>
          <div className="mb-6 grid gap-3 rounded-2xl border border-dark-200 bg-surface p-4 sm:grid-cols-[minmax(12rem,0.6fr)_minmax(12rem,0.6fr)_1fr] sm:items-end">
            <label className="grid gap-1.5 text-sm font-semibold text-dark-700">
              Appointment date
              <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="min-h-11 rounded-lg border border-dark-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-dark-700">
              Status
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-11 rounded-lg border border-dark-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                <option value="">All statuses</option>
                <option value="Booked">Booked</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
                <option value="No-Show">No-show</option>
              </select>
            </label>
            {(dateFilter || statusFilter) && <Button size="sm" variant="ghost" onClick={() => { setDateFilter(""); setStatusFilter(""); }} className="w-fit sm:justify-self-end">Clear filters</Button>}
          </div>

          {loading ? (
            <DashboardState type="loading" title="Loading bookings" />
          ) : error ? (
            <DashboardState type="error" title="Bookings unavailable" description={error} onRetry={fetchBookings} />
          ) : bookings.length === 0 ? (
            <DashboardState title="No bookings match these filters" description="Clear the filters or wait for a new customer appointment." />
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {bookings.map((booking) => (
                  <article key={booking.id} className="rounded-2xl border border-dark-200 bg-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary-700">{formatDate(booking.date)} · {booking.time?.slice(0, 5)}</p>
                        <h2 className="mt-2 font-semibold text-dark-900">{booking.customer_name}</h2>
                        <p className="mt-1 text-sm text-dark-500">{booking.customer_phone}</p>
                      </div>
                      <Badge variant={badgeVariant(booking.status)}>{booking.status}</Badge>
                    </div>
                    <div className="mt-4 border-t border-dark-200 pt-4">
                      <p className="text-sm font-semibold text-dark-800">{booking.service_name}</p>
                      {booking.staff_name && <p className="mt-1 text-xs text-dark-500">With {booking.staff_name}</p>}
                      <div className="mt-4">{actionsFor(booking)}</div>
                    </div>
                  </article>
                ))}
              </div>

              <Card className="hidden overflow-hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Business bookings</caption>
                    <thead><tr className="border-b border-dark-200 bg-dark-50">
                      {['Customer', 'Service', 'Staff', 'Date', 'Time', 'Status'].map((heading) => <th key={heading} scope="col" className="px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.1em] text-dark-500">{heading}</th>)}
                      <th scope="col" className="px-5 py-3 text-right text-xs font-bold uppercase tracking-[0.1em] text-dark-500">Actions</th>
                    </tr></thead>
                    <tbody className="divide-y divide-dark-200">
                      {bookings.map((booking) => (
                        <tr key={booking.id} className="hover:bg-dark-50/70">
                          <td className="px-5 py-4"><p className="font-semibold text-dark-900">{booking.customer_name}</p><p className="mt-1 text-xs text-dark-500">{booking.customer_phone}</p></td>
                          <td className="px-5 py-4 text-dark-700">{booking.service_name}</td>
                          <td className="px-5 py-4 text-dark-700">{booking.staff_name || "—"}</td>
                          <td className="whitespace-nowrap px-5 py-4 text-dark-700">{formatDate(booking.date)}</td>
                          <td className="px-5 py-4 font-mono tabular-nums text-dark-700">{booking.time?.slice(0, 5)}</td>
                          <td className="px-5 py-4"><Badge variant={badgeVariant(booking.status)}>{booking.status}</Badge></td>
                          <td className="px-5 py-4"><div className="flex justify-end">{actionsFor(booking)}</div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
