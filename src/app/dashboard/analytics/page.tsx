"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import Card, { CardContent, CardHeader } from "@/components/ui/Card";
import BarChart from "@/components/ui/BarChart";
import StarRating from "@/components/ui/StarRating";
import type { AnalyticsData } from "@/types";

type Period = "7d" | "30d" | "90d";

export default function AnalyticsPage() {
  const { business } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState<Period>("30d");
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    try {
      const result = await api.get<AnalyticsData>(
        `/businesses/${business.id}/analytics?period=${period}`
      );
      setData(result);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [business, period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const periodLabels: Record<Period, string> = {
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    "90d": "Last 90 days",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Analytics</h1>
          <p className="text-dark-500 text-sm mt-1">Track your business performance</p>
        </div>
        <div className="flex gap-1 bg-dark-100 rounded-lg p-1">
          {(["7d", "30d", "90d"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                period === p
                  ? "bg-white text-dark-900 shadow-sm"
                  : "text-dark-500 hover:text-dark-700"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-dark-400">Loading analytics...</p>
      ) : !data ? (
        <p className="text-dark-500">Failed to load analytics.</p>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent>
                <p className="text-sm text-dark-500">Revenue</p>
                <p className="text-2xl font-bold text-primary-600">
                  KES {data.total_revenue.toLocaleString()}
                </p>
                <p className="text-xs text-dark-400">{periodLabels[period]}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-sm text-dark-500">Bookings</p>
                <p className="text-2xl font-bold text-dark-900">{data.total_bookings}</p>
                <p className="text-xs text-dark-400">{periodLabels[period]}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-sm text-dark-500">Customers</p>
                <p className="text-2xl font-bold text-dark-900">{data.new_customers}</p>
                <p className="text-xs text-dark-400">{periodLabels[period]}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-sm text-dark-500">Avg Rating</p>
                <p className="text-2xl font-bold text-dark-900">
                  {data.avg_rating > 0 ? data.avg_rating.toFixed(1) : "—"}
                </p>
                {data.avg_rating > 0 && (
                  <StarRating rating={Math.round(data.avg_rating)} size="sm" />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Bookings Chart */}
            <Card>
              <CardHeader>
                <h2 className="font-semibold text-dark-900">Bookings</h2>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={data.bookings.map((b) => ({
                    label: new Date(b.date + "T00:00:00").toLocaleDateString("en-KE", {
                      month: "short",
                      day: "numeric",
                    }),
                    value: b.count,
                  }))}
                />
              </CardContent>
            </Card>

            {/* Revenue Chart */}
            <Card>
              <CardHeader>
                <h2 className="font-semibold text-dark-900">Revenue (KES)</h2>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={data.revenue.map((r) => ({
                    label: new Date(r.date + "T00:00:00").toLocaleDateString("en-KE", {
                      month: "short",
                      day: "numeric",
                    }),
                    value: r.amount,
                  }))}
                  color="bg-green-500"
                />
              </CardContent>
            </Card>

            {/* Popular Services */}
            <Card>
              <CardHeader>
                <h2 className="font-semibold text-dark-900">Popular Services</h2>
              </CardHeader>
              <CardContent>
                {data.popular_services.length === 0 ? (
                  <p className="text-sm text-dark-400">No data yet</p>
                ) : (
                  <div className="space-y-3">
                    {data.popular_services.map((svc, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-dark-400 w-5">{i + 1}.</span>
                          <span className="text-sm text-dark-900">{svc.name}</span>
                        </div>
                        <span className="text-sm font-medium text-dark-700">
                          {svc.count} bookings
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Peak Hours */}
            <Card>
              <CardHeader>
                <h2 className="font-semibold text-dark-900">Peak Hours</h2>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={data.peak_hours.map((h) => ({
                    label: `${String(h.hour).padStart(2, "0")}:00`,
                    value: h.count,
                  }))}
                  color="bg-blue-500"
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
