"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCustomerAuth, customerApi } from "@/lib/customer-auth-context";
import Card, { CardContent } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import type { Booking } from "@/types";

export default function CustomerDashboard() {
  const { customer, loading, logout } = useCustomerAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !customer) {
      router.push("/customer/auth/login");
    }
  }, [loading, customer, router]);

  useEffect(() => {
    if (!customer) return;
    customerApi
      .get<Booking[]>("/customer/bookings")
      .then(setBookings)
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [customer]);

  const handleCancel = async (bookingId: string) => {
    if (!confirm("Cancel this booking?")) return;
    try {
      await customerApi.patch(`/customer/bookings/${bookingId}`, {});
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: "Cancelled" as const } : b))
      );
    } catch {
      // silent
    }
  };

  if (loading || !customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-50">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const upcoming = bookings.filter((b) => b.status === "Booked" && b.date >= new Date().toISOString().split("T")[0]);
  const past = bookings.filter((b) => b.status !== "Booked" || b.date < new Date().toISOString().split("T")[0]);

  const badgeVariant = (status: string) => {
    if (status === "Booked") return "success" as const;
    if (status === "Cancelled") return "danger" as const;
    return "default" as const;
  };

  return (
    <div className="min-h-screen bg-dark-50">
      {/* Header */}
      <nav className="bg-white border-b border-dark-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">SB</span>
              </div>
              <span className="text-lg font-bold text-dark-900">SalonBook</span>
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-sm text-dark-500">Hi, {customer.name}</span>
              <Button size="sm" variant="ghost" onClick={logout}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-dark-900">My Bookings</h1>
          <p className="text-dark-500 mt-1">View and manage your appointments</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent>
              <p className="text-sm text-dark-500">Upcoming</p>
              <p className="text-2xl font-bold text-primary-600 mt-1">{upcoming.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm text-dark-500">Total</p>
              <p className="text-2xl font-bold text-dark-900 mt-1">{bookings.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm text-dark-500">Completed</p>
              <p className="text-2xl font-bold text-dark-900 mt-1">
                {bookings.filter((b) => b.status === "Completed").length}
              </p>
            </CardContent>
          </Card>
        </div>

        {fetching ? (
          <p className="text-dark-400">Loading bookings...</p>
        ) : bookings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-dark-500 mb-4">You haven&apos;t booked any appointments yet.</p>
              <p className="text-sm text-dark-400">
                Ask your salon for their booking link to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Upcoming Bookings */}
            {upcoming.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-dark-900 mb-3">Upcoming</h2>
                <div className="space-y-3">
                  {upcoming.map((booking) => (
                    <Card key={booking.id}>
                      <CardContent>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-dark-900">{booking.service_name}</h3>
                              <Badge variant={badgeVariant(booking.status)}>
                                {booking.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-dark-500">
                              {booking.business_name} &middot; {booking.business_location}
                            </p>
                            <p className="text-sm text-dark-700 mt-1">
                              {new Date(booking.date).toLocaleDateString("en-KE", {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                              })}{" "}
                              at {booking.time?.slice(0, 5)}
                            </p>
                            {booking.service_price && (
                              <p className="text-sm font-medium text-primary-600 mt-1">
                                KES {Number(booking.service_price).toLocaleString()}
                              </p>
                            )}
                          </div>
                          {booking.status === "Booked" && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleCancel(booking.id)}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Past Bookings */}
            {past.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-dark-900 mb-3">Past</h2>
                <div className="space-y-3">
                  {past.map((booking) => (
                    <Card key={booking.id} className="opacity-75">
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-dark-900">{booking.service_name}</h3>
                              <Badge variant={badgeVariant(booking.status)}>
                                {booking.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-dark-500">
                              {booking.business_name} &middot;{" "}
                              {new Date(booking.date).toLocaleDateString("en-KE", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}{" "}
                              at {booking.time?.slice(0, 5)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
