"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCustomerAuth, customerApi } from "@/lib/customer-auth-context";
import Card, { CardContent } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import StarRating from "@/components/ui/StarRating";
import type { Booking } from "@/types";

export default function CustomerDashboard() {
  const { customer, loading, logout } = useCustomerAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [fetching, setFetching] = useState(true);

  // Review state
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewBookingId, setReviewBookingId] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewedBookings, setReviewedBookings] = useState<Set<string>>(new Set());

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

  const openReviewModal = (bookingId: string) => {
    setReviewBookingId(bookingId);
    setReviewRating(0);
    setReviewComment("");
    setReviewModal(true);
  };

  const handleSubmitReview = async () => {
    if (!reviewRating || !reviewBookingId) return;
    setSubmittingReview(true);
    try {
      await customerApi.post("/reviews", {
        booking_id: reviewBookingId,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      setReviewedBookings((prev) => new Set(prev).add(reviewBookingId));
      setReviewModal(false);
    } catch {
      // silent
    } finally {
      setSubmittingReview(false);
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
    if (status === "Cancelled" || status === "No-Show") return "danger" as const;
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
                            {booking.staff_name && (
                              <p className="text-xs text-dark-400 mt-0.5">with {booking.staff_name}</p>
                            )}
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
                          {booking.status === "Completed" && !reviewedBookings.has(booking.id) && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openReviewModal(booking.id)}
                            >
                              Leave Review
                            </Button>
                          )}
                          {reviewedBookings.has(booking.id) && (
                            <span className="text-xs text-green-600 font-medium">Reviewed</span>
                          )}
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

      {/* Review Modal */}
      <Modal
        open={reviewModal}
        onClose={() => setReviewModal(false)}
        title="Leave a Review"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-2">Rating</label>
            <StarRating rating={reviewRating} onChange={setReviewRating} size="lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">
              Comment (optional)
            </label>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="How was your experience?"
              rows={3}
              className="w-full px-3 py-2 border border-dark-200 rounded-lg text-dark-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSubmitReview}
              loading={submittingReview}
              disabled={!reviewRating}
            >
              Submit Review
            </Button>
            <Button variant="secondary" onClick={() => setReviewModal(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
