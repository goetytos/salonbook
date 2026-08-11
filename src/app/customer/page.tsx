"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { customerApi, useCustomerAuth } from "@/lib/customer-auth-context";
import BrandMark from "@/components/brand/BrandMark";
import BusinessCard from "@/components/booking/BusinessCard";
import DashboardState from "@/components/dashboard/DashboardState";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card, { CardContent } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import StarRating from "@/components/ui/StarRating";
import Textarea from "@/components/ui/Textarea";
import type { Booking } from "@/types";

interface DiscoverBusiness {
  id: string;
  name: string;
  slug: string;
  location: string;
  category?: string;
  avatar_url?: string;
  avg_rating: number;
  review_count: number;
}

export default function CustomerDashboard() {
  const { customer, loading, logout } = useCustomerAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [fetching, setFetching] = useState(true);
  const [bookingsError, setBookingsError] = useState("");
  const [actionError, setActionError] = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewBookingId, setReviewBookingId] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewedBookings, setReviewedBookings] = useState<Set<string>>(new Set());
  const [salons, setSalons] = useState<DiscoverBusiness[]>([]);
  const [loadingSalons, setLoadingSalons] = useState(true);
  const [salonsError, setSalonsError] = useState("");

  useEffect(() => {
    if (!loading && !customer) router.push("/customer/auth/login");
  }, [loading, customer, router]);

  const fetchBookings = useCallback(async () => {
    if (!customer) return;
    setFetching(true);
    setBookingsError("");
    try {
      const data = await customerApi.get<Booking[]>("/customer/bookings");
      setBookings(data);
    } catch (requestError) {
      setBookings([]);
      setBookingsError(requestError instanceof Error ? requestError.message : "Your bookings could not be loaded.");
    } finally {
      setFetching(false);
    }
  }, [customer]);

  const fetchSalons = useCallback(async () => {
    setLoadingSalons(true);
    setSalonsError("");
    try {
      const response = await fetch("/api/discover");
      if (!response.ok) throw new Error("Studios could not be loaded.");
      const data = await response.json();
      setSalons(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setSalons([]);
      setSalonsError(requestError instanceof Error ? requestError.message : "Studios could not be loaded.");
    } finally {
      setLoadingSalons(false);
    }
  }, []);

  useEffect(() => {
    void fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    void fetchSalons();
  }, [fetchSalons]);

  const handleCancel = async (bookingId: string) => {
    if (!confirm("Cancel this booking?")) return;
    setCancelling(bookingId);
    setActionError("");
    try {
      await customerApi.patch(`/customer/bookings/${bookingId}`, {});
      setBookings((current) => current.map((booking) => booking.id === bookingId ? { ...booking, status: "Cancelled" as const } : booking));
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "The booking could not be cancelled.");
    } finally {
      setCancelling(null);
    }
  };

  const openReviewModal = (bookingId: string) => {
    setReviewBookingId(bookingId);
    setReviewRating(0);
    setReviewComment("");
    setReviewError("");
    setReviewModal(true);
  };

  const handleSubmitReview = async () => {
    if (!reviewRating || !reviewBookingId) return;
    setSubmittingReview(true);
    setReviewError("");
    try {
      await customerApi.post("/reviews", {
        booking_id: reviewBookingId,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      setReviewedBookings((current) => new Set(current).add(reviewBookingId));
      setReviewModal(false);
    } catch (requestError) {
      setReviewError(requestError instanceof Error ? requestError.message : "Your review could not be submitted.");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading || !customer) {
    return (
      <main id="main-content" className="studio-grid flex min-h-dvh items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-lg space-y-3" role="status" aria-label={loading ? "Loading customer account" : "Opening customer sign in"}>
          <div className="h-16 animate-pulse rounded-2xl bg-dark-100 motion-reduce:animate-none" />
          <div className="h-36 animate-pulse rounded-2xl bg-dark-100 motion-reduce:animate-none" />
          <span className="sr-only">{loading ? "Loading customer account" : "Opening customer sign in"}</span>
        </div>
      </main>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const upcoming = bookings.filter((booking) => booking.status === "Booked" && booking.date >= today);
  const past = bookings.filter((booking) => booking.status !== "Booked" || booking.date < today);
  const completedCount = bookings.filter((booking) => booking.status === "Completed").length;
  const reviewBooking = bookings.find((booking) => booking.id === reviewBookingId);
  const badgeVariant = (status: string) => status === "Booked" ? "success" as const : status === "Cancelled" || status === "No-Show" ? "danger" as const : "default" as const;
  const formatDate = (date: string, includeYear = false) => new Date(`${date.split("T")[0]}T00:00:00`).toLocaleDateString("en-KE", {
    weekday: includeYear ? undefined : "long",
    month: "long",
    day: "numeric",
    year: includeYear ? "numeric" : undefined,
  });

  const handleLogout = () => {
    logout();
    router.push("/customer/auth/login");
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-40 border-b border-dark-200 bg-surface/95 backdrop-blur-xl">
        <nav className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8" aria-label="Customer account navigation">
          <Link href="/" aria-label="SalonBook home" className="shrink-0 rounded-lg"><BrandMark /></Link>
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden max-w-48 truncate text-sm text-dark-500 md:block">Hello, {customer.name}</span>
            <Link href="/explore" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary-900 px-3 text-sm font-bold text-white hover:bg-primary-700">Explore studios</Link>
            <Button size="sm" variant="ghost" onClick={handleLogout} className="hidden sm:inline-flex">Sign out</Button>
            <button type="button" aria-label="Sign out" onClick={handleLogout} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-dark-600 hover:bg-dark-50 sm:hidden">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M10 5H6a2 2 0 00-2 2v10a2 2 0 002 2h4m5-4 3-3-3-3m3 3H9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </nav>
      </header>

      <main id="main-content" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <header className="mb-7 grid gap-6 overflow-hidden rounded-[1.4rem] bg-primary-900 p-6 text-white shadow-[0_20px_60px_rgba(16,43,36,0.14)] sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-accent-300">My SalonBook</p>
            <h1 className="mt-3 text-balance font-display text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Your next visit starts here, {customer.name.split(" ")[0]}.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-primary-100">Keep track of appointments and return to studios that feel right for you.</p>
          </div>
          <Link href="/explore" className="inline-flex min-h-11 w-fit items-center justify-center rounded-lg bg-white px-4 text-sm font-bold text-primary-900 hover:bg-primary-50">Find a studio</Link>
        </header>

        <section className="mb-8 grid grid-cols-3 gap-3" aria-label="Booking totals">
          {[
            { label: "Upcoming", value: upcoming.length, accent: true },
            { label: "All bookings", value: bookings.length },
            { label: "Completed", value: completedCount },
          ].map((stat) => (
            <Card key={stat.label} className={stat.accent ? "border-primary-300 bg-primary-50" : ""}>
              <CardContent className="px-3 py-4 sm:px-5">
                <p className="text-[0.64rem] font-bold uppercase tracking-[0.11em] text-dark-500">{stat.label}</p>
                <p className={`mt-2 font-display text-3xl font-semibold tabular-nums ${stat.accent ? "text-primary-700" : "text-dark-900"}`}>{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        {actionError && <div className="mb-6"><DashboardState type="error" title="Your booking was not changed" description={actionError} /></div>}

        <section className="mb-10" aria-labelledby="discover-heading">
          <div className="mb-4 flex items-end justify-between gap-4 border-b border-dark-200 pb-4">
            <div><p className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-primary-700">Discover nearby</p><h2 id="discover-heading" className="mt-1 font-display text-2xl font-semibold text-dark-900">Choose your next studio</h2></div>
            <Link href="/explore" className="inline-flex min-h-11 shrink-0 items-center text-sm font-bold text-primary-700 hover:underline">View all <span aria-hidden="true">→</span></Link>
          </div>
          {loadingSalons ? (
            <DashboardState type="loading" title="Loading studios" />
          ) : salonsError ? (
            <DashboardState type="error" title="Studios unavailable" description={salonsError} onRetry={() => void fetchSalons()} />
          ) : salons.length === 0 ? (
            <DashboardState title="No studios available right now" description="Check again soon as businesses update their public profiles." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {salons.slice(0, 6).map((salon) => <BusinessCard key={salon.id} {...salon} avg_rating={Number(salon.avg_rating)} />)}
            </div>
          )}
        </section>

        <section aria-labelledby="bookings-heading">
          <div className="mb-4 border-b border-dark-200 pb-4">
            <p className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-primary-700">Appointment record</p>
            <h2 id="bookings-heading" className="mt-1 font-display text-2xl font-semibold text-dark-900">My bookings</h2>
          </div>

          {fetching ? (
            <DashboardState type="loading" title="Loading your bookings" />
          ) : bookingsError ? (
            <DashboardState type="error" title="Bookings unavailable" description={bookingsError} onRetry={() => void fetchBookings()} />
          ) : bookings.length === 0 ? (
            <Card><CardContent className="p-2 sm:p-2"><EmptyState title="No bookings yet" description="Browse studios, choose a service and your appointment will appear here." actionLabel="Explore studios" onAction={() => router.push("/explore")} /></CardContent></Card>
          ) : (
            <div className="space-y-8">
              {upcoming.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-dark-500">Upcoming</h3>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {upcoming.map((booking) => {
                      const busy = cancelling === booking.id;
                      return (
                        <Card key={booking.id} className="overflow-hidden">
                          <CardContent className="flex h-full flex-col">
                            <div className="flex items-start justify-between gap-3">
                              <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary-700">{formatDate(booking.date)}</p><h4 className="mt-2 font-display text-xl font-semibold text-dark-900">{booking.service_name}</h4></div>
                              <Badge variant={badgeVariant(booking.status)}>{booking.status}</Badge>
                            </div>
                            <p className="mt-4 text-sm font-semibold text-dark-800">{booking.business_name}</p>
                            <p className="mt-1 text-sm text-dark-500">{booking.business_location} · {booking.time?.slice(0, 5)}</p>
                            {booking.staff_name && <p className="mt-1 text-xs text-dark-500">With {booking.staff_name}</p>}
                            <div className="mt-auto flex items-end justify-between gap-4 border-t border-dark-200 pt-5">
                              <p className="font-bold tabular-nums text-primary-700">{booking.service_price != null ? `KES ${Number(booking.service_price).toLocaleString()}` : ""}</p>
                              <div aria-busy={busy || undefined}><Button size="sm" variant="danger" disabled={busy} onClick={() => void handleCancel(booking.id)}>{busy ? "Cancelling…" : "Cancel booking"}</Button></div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {past.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-dark-500">Past and cancelled</h3>
                  <div className="space-y-3">
                    {past.map((booking) => (
                      <Card key={booking.id} className="bg-surface/75">
                        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold text-dark-900">{booking.service_name}</h4><Badge variant={badgeVariant(booking.status)}>{booking.status}</Badge></div>
                            <p className="mt-2 text-sm text-dark-500">{booking.business_name} · {formatDate(booking.date, true)} at {booking.time?.slice(0, 5)}</p>
                          </div>
                          {booking.status === "Completed" && !reviewedBookings.has(booking.id) && <Button size="sm" variant="secondary" className="w-full sm:w-auto" onClick={() => openReviewModal(booking.id)}>Leave a review</Button>}
                          {reviewedBookings.has(booking.id) && <Badge variant="success">Reviewed</Badge>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <Modal open={reviewModal} onClose={() => setReviewModal(false)} title="Leave a review">
        <div className="space-y-4">
          {reviewBooking && <p className="rounded-xl bg-dark-50 p-3 text-sm text-dark-600">{reviewBooking.service_name} at <span className="font-semibold text-dark-900">{reviewBooking.business_name}</span></p>}
          {reviewError && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{reviewError}</p>}
          <div>
            <p className="mb-2 text-sm font-medium text-dark-700">Your rating</p>
            <StarRating rating={reviewRating} onChange={setReviewRating} size="lg" ariaLabel="Choose a rating from one to five stars" />
          </div>
          <Textarea label="Comment (optional)" value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="What stood out about your experience?" rows={4} />
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setReviewModal(false)}>Cancel</Button>
            <Button onClick={() => void handleSubmitReview()} loading={submittingReview} disabled={!reviewRating}>Submit review</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
