"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import Card, { CardContent } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { Booking } from "@/types";

export default function DashboardOverview() {
  const { business, stats, refresh } = useAuth();
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!business) return;
    const today = new Date().toISOString().split("T")[0];
    api
      .get<Booking[]>(`/businesses/${business.id}/bookings?date=${today}`)
      .then(setUpcomingBookings)
      .catch(() => {})
      .finally(() => setLoading(false));
    refresh();
  }, [business, refresh]);

  if (!stats) return null;

  const statCards = [
    { label: "Total Bookings", value: stats.total_bookings, color: "text-dark-900" },
    { label: "Today", value: stats.today_bookings, color: "text-primary-600" },
    { label: "Upcoming", value: stats.upcoming_bookings, color: "text-blue-600" },
    { label: "This Month", value: stats.monthly_bookings, color: "text-dark-900" },
    { label: "Customers", value: stats.total_customers, color: "text-dark-900" },
    {
      label: "Monthly Revenue",
      value: `KES ${Number(stats.monthly_revenue).toLocaleString()}`,
      color: "text-primary-600",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-dark-900">
          Welcome back, {business?.name}
        </h1>
        <p className="text-dark-500 mt-1">Here&apos;s what&apos;s happening today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent>
              <p className="text-sm text-dark-500">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Today's Bookings */}
      <Card>
        <div className="px-6 py-4 border-b border-dark-100">
          <h2 className="text-lg font-semibold text-dark-900">
            Today&apos;s Bookings
          </h2>
        </div>
        <CardContent>
          {loading ? (
            <p className="text-dark-400 text-sm py-4">Loading...</p>
          ) : upcomingBookings.length === 0 ? (
            <p className="text-dark-400 text-sm py-4">No bookings today.</p>
          ) : (
            <div className="divide-y divide-dark-100">
              {upcomingBookings.map((booking) => (
                <div key={booking.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-dark-900">
                      {booking.customer_name}
                    </p>
                    <p className="text-xs text-dark-500">
                      {booking.service_name} &middot; {booking.time?.slice(0, 5)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      booking.status === "Booked"
                        ? "success"
                        : booking.status === "Cancelled"
                        ? "danger"
                        : "default"
                    }
                  >
                    {booking.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Booking Link */}
      {business && (
        <div className="mt-6 p-4 bg-primary-50 border border-primary-200 rounded-xl">
          <p className="text-sm font-medium text-primary-800">
            Share your booking link with customers:
          </p>
          <p className="text-sm text-primary-600 mt-1 font-mono">
            {typeof window !== "undefined" ? window.location.origin : ""}/book/{business.slug}
          </p>
        </div>
      )}
    </div>
  );
}
