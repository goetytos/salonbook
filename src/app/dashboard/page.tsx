"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import Card, { CardContent, CardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import BarChart from "@/components/ui/BarChart";
import PageHeader from "@/components/dashboard/PageHeader";
import DashboardState from "@/components/dashboard/DashboardState";
import type { Booking, AnalyticsData } from "@/types";

export default function DashboardOverview() {
  const { business, stats, refresh } = useAuth();
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ label: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!business) return;
    const today = new Date().toISOString().split("T")[0];
    setLoading(true);
    setError("");

    Promise.all([
      api.get<Booking[]>(`/businesses/${business.id}/bookings?date=${today}`),
      api.get<AnalyticsData>(`/businesses/${business.id}/analytics?period=7d`).catch(() => null),
    ])
      .then(([bookings, analytics]) => {
        setTodayBookings(bookings);
        setWeeklyData(
          analytics?.bookings.map((entry) => ({
            label: new Date(entry.date + "T00:00:00").toLocaleDateString("en-KE", { weekday: "short" }),
            value: entry.count,
          })) || []
        );
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Dashboard data could not be loaded.");
      })
      .finally(() => setLoading(false));

    void refresh();
  }, [business, refresh]);

  const badgeVariant = (status: string) => {
    if (status === "Booked") return "success" as const;
    if (status === "Cancelled" || status === "No-Show") return "danger" as const;
    return "default" as const;
  };

  return (
    <div>
      <PageHeader
        eyebrow="Today"
        title={business ? `Welcome back, ${business.name}` : "Business overview"}
        description="Your schedule, customer activity and the numbers that need attention today."
        actions={
          <>
            <Link href="/dashboard/bookings" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-dark-300 bg-surface px-4 text-sm font-bold text-dark-800 hover:bg-dark-50">
              View bookings
            </Link>
            {business && (
              <Link href={`/book/${business.slug}`} target="_blank" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary-900 px-4 text-sm font-bold text-white hover:bg-primary-700">
                Open booking page <span className="ml-1" aria-hidden="true">↗</span>
              </Link>
            )}
          </>
        }
      />

      {!stats ? (
        <DashboardState type="loading" title="Loading business totals" />
      ) : (
        <>
          <section aria-label="Business summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="relative overflow-hidden rounded-[1.25rem] bg-primary-900 p-5 text-white sm:col-span-2 xl:col-span-1">
              <div className="studio-grain absolute inset-0 opacity-60" aria-hidden="true" />
              <div className="relative">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary-300">Revenue this month</p>
                <p className="mt-4 text-3xl font-bold tabular-nums">KES {Number(stats.monthly_revenue).toLocaleString()}</p>
                <p className="mt-2 text-xs text-primary-300">From completed appointments</p>
              </div>
            </div>
            {[
              ["Today", stats.today_bookings, "Appointments on today’s schedule"],
              ["Upcoming", stats.upcoming_bookings, "Future booked appointments"],
              ["Customers", stats.total_customers, "Customers in your records"],
            ].map(([label, value, detail]) => (
              <Card key={String(label)}>
                <CardContent className="py-5">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-dark-500">{label}</p>
                  <p className="mt-3 text-3xl font-bold tabular-nums text-dark-900">{value}</p>
                  <p className="mt-2 text-xs leading-5 text-dark-400">{detail}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          {error && <div className="mt-5"><DashboardState type="error" title="Some dashboard data is unavailable" description={error} /></div>}

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-700">Schedule</p>
                  <h2 className="mt-1 text-lg font-semibold text-dark-900">Today&apos;s bookings</h2>
                </div>
                <Link href="/dashboard/bookings" className="text-sm font-bold text-primary-700 hover:underline">View all</Link>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <DashboardState type="loading" title="Loading today's bookings" />
                ) : todayBookings.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="font-semibold text-dark-800">Your schedule is clear today.</p>
                    <p className="mt-2 text-sm text-dark-500">New online bookings will appear here.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-dark-200">
                    {todayBookings.map((booking) => (
                      <div key={booking.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-4">
                          <span className="min-w-14 font-mono text-sm font-bold tabular-nums text-primary-700">{booking.time?.slice(0, 5)}</span>
                          <div>
                            <p className="font-semibold text-dark-900">{booking.customer_name}</p>
                            <p className="mt-1 text-sm text-dark-500">{booking.service_name}{booking.staff_name && ` · ${booking.staff_name}`}</p>
                          </div>
                        </div>
                        <Badge variant={badgeVariant(booking.status)}>{booking.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-700">Seven-day view</p>
                <h2 className="mt-1 text-lg font-semibold text-dark-900">Bookings this week</h2>
              </CardHeader>
              <CardContent>
                {weeklyData.length > 0 ? (
                  <BarChart data={weeklyData} maxHeight={180} ariaLabel="Bookings during the last seven days" />
                ) : (
                  <div className="py-8 text-center text-sm text-dark-500">No booking activity to chart yet.</div>
                )}
              </CardContent>
            </Card>
          </div>

          <section className="mt-6 grid gap-4 sm:grid-cols-3" aria-label="Additional totals">
            {[
              ["All bookings", stats.total_bookings],
              ["This month", stats.monthly_bookings],
              ["Customer records", stats.total_customers],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between border-b border-dark-300 py-4">
                <span className="text-sm font-semibold text-dark-600">{label}</span>
                <span className="font-mono text-lg font-bold tabular-nums text-dark-900">{value}</span>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
