"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import BarChart from "@/components/ui/BarChart";
import Card, { CardContent, CardHeader } from "@/components/ui/Card";
import StarRating from "@/components/ui/StarRating";
import DashboardState from "@/components/dashboard/DashboardState";
import PageHeader from "@/components/dashboard/PageHeader";
import type { AnalyticsData } from "@/types";

type Period = "7d" | "30d" | "90d";

const PERIOD_LABELS: Record<Period, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

export default function AnalyticsPage() {
  const { business } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState<Period>("30d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAnalytics = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    setError("");
    try {
      const result = await api.get<AnalyticsData>(`/businesses/${business.id}/analytics?period=${period}`);
      setData(result);
    } catch (requestError) {
      setData(null);
      setError(requestError instanceof Error ? requestError.message : "Analytics could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [business, period]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  const periodControl = (
    <div className="flex rounded-xl border border-dark-200 bg-surface p-1" role="group" aria-label="Analytics period">
      {(["7d", "30d", "90d"] as Period[]).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={period === option}
          onClick={() => setPeriod(option)}
          className={`min-h-11 rounded-lg px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
            period === option ? "bg-primary-900 text-white shadow-sm" : "text-dark-500 hover:bg-dark-50 hover:text-dark-800"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Performance"
        title="Analytics"
        description="A clear view of demand, revenue and the services shaping your studio."
        actions={periodControl}
      />

      {loading ? (
        <DashboardState type="loading" title={`Loading analytics for ${PERIOD_LABELS[period].toLowerCase()}`} />
      ) : error || !data ? (
        <DashboardState type="error" title="Analytics unavailable" description={error || "No analytics response was returned."} onRetry={() => void fetchAnalytics()} />
      ) : (
        <>
          <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Performance summary">
            <MetricCard label="Revenue" value={`KES ${Number(data.total_revenue).toLocaleString()}`} period={PERIOD_LABELS[period]} accent />
            <MetricCard label="Bookings" value={Number(data.total_bookings).toLocaleString()} period={PERIOD_LABELS[period]} />
            <MetricCard label="New customers" value={Number(data.new_customers).toLocaleString()} period={PERIOD_LABELS[period]} />
            <Card>
              <CardContent className="h-full">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-dark-500">Average rating</p>
                <p className="mt-3 font-display text-3xl font-semibold tracking-[-0.04em] text-dark-900">
                  {data.avg_rating > 0 ? Number(data.avg_rating).toFixed(1) : "—"}
                </p>
                <div className="mt-2 min-h-5">
                  {data.avg_rating > 0 ? <StarRating rating={data.avg_rating} size="sm" /> : <span className="text-xs text-dark-500">No ratings in this period</span>}
                </div>
              </CardContent>
            </Card>
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <ChartCard title="Booking rhythm" description="Appointments by day">
              <div className="overflow-x-auto pb-2">
                <div style={{ minWidth: Math.max(data.bookings.length * 28, 420) }}>
                  <BarChart
                    ariaLabel={`Bookings by day for ${PERIOD_LABELS[period].toLowerCase()}`}
                    data={data.bookings.map((booking) => ({
                      label: new Date(`${booking.date}T00:00:00`).toLocaleDateString("en-KE", { month: "short", day: "numeric" }),
                      value: booking.count,
                    }))}
                  />
                </div>
              </div>
            </ChartCard>

            <ChartCard title="Revenue flow" description="Revenue in Kenyan shillings">
              <div className="overflow-x-auto pb-2">
                <div style={{ minWidth: Math.max(data.revenue.length * 28, 420) }}>
                  <BarChart
                    ariaLabel={`Revenue by day in Kenyan shillings for ${PERIOD_LABELS[period].toLowerCase()}`}
                    data={data.revenue.map((revenue) => ({
                      label: new Date(`${revenue.date}T00:00:00`).toLocaleDateString("en-KE", { month: "short", day: "numeric" }),
                      value: revenue.amount,
                    }))}
                    color="bg-accent-400"
                  />
                </div>
              </div>
            </ChartCard>

            <Card>
              <CardHeader>
                <h2 className="font-display text-xl font-semibold text-dark-900">Popular services</h2>
                <p className="mt-1 text-xs text-dark-500">Ranked by booking volume</p>
              </CardHeader>
              <CardContent>
                {data.popular_services.length === 0 ? (
                  <p className="rounded-xl bg-dark-50 p-5 text-sm text-dark-500" role="status">No service bookings were recorded in this period.</p>
                ) : (
                  <ol className="divide-y divide-dark-200">
                    {data.popular_services.map((service, index) => (
                      <li key={`${service.name}-${index}`} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 py-3 first:pt-0 last:pb-0">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-xs font-extrabold text-primary-700" aria-hidden="true">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 truncate text-sm font-semibold text-dark-900">{service.name}</span>
                        <span className="text-sm tabular-nums text-dark-500">{service.count} booking{service.count === 1 ? "" : "s"}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>

            <ChartCard title="Peak hours" description="When appointments most often begin">
              <div className="overflow-x-auto pb-2">
                <div style={{ minWidth: Math.max(data.peak_hours.length * 42, 420) }}>
                  <BarChart
                    ariaLabel={`Bookings by start hour for ${PERIOD_LABELS[period].toLowerCase()}`}
                    data={data.peak_hours.map((hour) => ({
                      label: `${String(hour.hour).padStart(2, "0")}:00`,
                      value: hour.count,
                    }))}
                    color="bg-primary-300"
                  />
                </div>
              </div>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, period, accent = false }: { label: string; value: string; period: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-primary-300 bg-primary-900 text-white" : ""}>
      <CardContent>
        <p className={`text-[0.68rem] font-bold uppercase tracking-[0.14em] ${accent ? "text-primary-200" : "text-dark-500"}`}>{label}</p>
        <p className={`mt-3 font-display text-3xl font-semibold tracking-[-0.04em] ${accent ? "text-white" : "text-dark-900"}`}>{value}</p>
        <p className={`mt-2 text-xs ${accent ? "text-primary-200" : "text-dark-500"}`}>{period}</p>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <h2 className="font-display text-xl font-semibold text-dark-900">{title}</h2>
        <p className="mt-1 text-xs text-dark-500">{description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
