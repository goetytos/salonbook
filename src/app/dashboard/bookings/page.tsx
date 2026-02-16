"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import Card, { CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import type { Booking, BookingStatus } from "@/types";

export default function BookingsPage() {
  const { business } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchBookings = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFilter) params.set("date", dateFilter);
      if (statusFilter) params.set("status", statusFilter);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const data = await api.get<Booking[]>(`/businesses/${business.id}/bookings${qs}`);
      setBookings(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [business, dateFilter, statusFilter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const updateStatus = async (bookingId: string, status: BookingStatus) => {
    if (!business) return;
    try {
      await api.patch(`/businesses/${business.id}/bookings/${bookingId}`, { status });
      await fetchBookings();
    } catch {
      // silent
    }
  };

  const badgeVariant = (status: string) => {
    if (status === "Booked") return "success";
    if (status === "Cancelled") return "danger";
    return "default";
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark-900">Bookings</h1>
        <p className="text-dark-500 text-sm mt-1">View and manage appointments</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-2 border border-dark-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-dark-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Statuses</option>
          <option value="Booked">Booked</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        {(dateFilter || statusFilter) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDateFilter("");
              setStatusFilter("");
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Bookings List */}
      {loading ? (
        <p className="text-dark-400">Loading...</p>
      ) : bookings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-dark-500">No bookings found.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-100">
                  <th className="text-left px-6 py-3 font-medium text-dark-500">Customer</th>
                  <th className="text-left px-6 py-3 font-medium text-dark-500">Service</th>
                  <th className="text-left px-6 py-3 font-medium text-dark-500">Date</th>
                  <th className="text-left px-6 py-3 font-medium text-dark-500">Time</th>
                  <th className="text-left px-6 py-3 font-medium text-dark-500">Status</th>
                  <th className="text-right px-6 py-3 font-medium text-dark-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-100">
                {bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-dark-50 transition">
                    <td className="px-6 py-3">
                      <p className="font-medium text-dark-900">{booking.customer_name}</p>
                      <p className="text-xs text-dark-400">{booking.customer_phone}</p>
                    </td>
                    <td className="px-6 py-3 text-dark-700">{booking.service_name}</td>
                    <td className="px-6 py-3 text-dark-700">
                      {new Date(booking.date).toLocaleDateString("en-KE", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-3 text-dark-700">
                      {booking.time?.slice(0, 5)}
                    </td>
                    <td className="px-6 py-3">
                      <Badge variant={badgeVariant(booking.status)}>
                        {booking.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-right">
                      {booking.status === "Booked" && (
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => updateStatus(booking.id, "Completed")}
                          >
                            Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => updateStatus(booking.id, "Cancelled")}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
