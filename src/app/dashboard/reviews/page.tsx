"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import Avatar from "@/components/ui/Avatar";
import Card, { CardContent } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import StarRating from "@/components/ui/StarRating";
import DashboardState from "@/components/dashboard/DashboardState";
import PageHeader from "@/components/dashboard/PageHeader";
import type { Review } from "@/types";

interface ReviewsResponse {
  reviews: Review[];
  total: number;
  avg_rating: number;
  review_count: number;
}

export default function ReviewsPage() {
  const { business } = useAuth();
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchReviews = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    setError("");
    try {
      const result = await api.get<ReviewsResponse>(`/businesses/${business.id}/reviews`);
      setData(result);
    } catch (requestError) {
      setData(null);
      setError(requestError instanceof Error ? requestError.message : "Reviews could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [business]);

  useEffect(() => {
    void fetchReviews();
  }, [fetchReviews]);

  return (
    <div>
      <PageHeader
        eyebrow="Reputation"
        title="Reviews"
        description="Read the details behind your rating and understand how each customer experienced their visit."
      />

      {loading ? (
        <DashboardState type="loading" title="Loading reviews" />
      ) : error ? (
        <DashboardState type="error" title="Reviews unavailable" description={error} onRetry={() => void fetchReviews()} />
      ) : !data || data.reviews.length === 0 ? (
        <Card>
          <CardContent className="p-2 sm:p-2">
            <EmptyState
              icon={
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              }
              title="No reviews yet"
              description="Customer feedback will collect here once completed appointments begin receiving ratings."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mb-6 overflow-hidden">
            <CardContent className="grid gap-6 bg-[linear-gradient(125deg,var(--color-primary-900),var(--color-primary-700))] text-white md:grid-cols-[13rem_1fr] md:items-center">
              <div className="border-b border-white/15 pb-6 text-center md:border-b-0 md:border-r md:pb-0 md:pr-6">
                <p className="font-display text-6xl font-semibold tracking-[-0.06em]">{Number(data.avg_rating).toFixed(1)}</p>
                <div className="mt-3"><StarRating rating={data.avg_rating} size="md" /></div>
                <p className="mt-2 text-sm text-primary-100">{data.review_count} review{data.review_count === 1 ? "" : "s"}</p>
              </div>
              <div className="space-y-2.5" aria-label="Rating distribution">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = data.reviews.filter((review) => review.rating === star).length;
                  const percentage = data.review_count > 0 ? (count / data.review_count) * 100 : 0;
                  return (
                    <div key={star} className="grid grid-cols-[2rem_1fr_2rem] items-center gap-3 text-xs">
                      <span className="font-bold text-primary-50">{star}★</span>
                      <div
                        className="h-2 overflow-hidden rounded-full bg-white/15"
                        role="progressbar"
                        aria-label={`${star} star reviews`}
                        aria-valuemin={0}
                        aria-valuemax={data.review_count}
                        aria-valuenow={count}
                      >
                        <div className="h-full rounded-full bg-accent-300" style={{ width: `${Math.min(percentage, 100)}%` }} />
                      </div>
                      <span className="text-right tabular-nums text-primary-100">{count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <section className="grid gap-4 xl:grid-cols-2" aria-label="Customer reviews">
            {data.reviews.map((review) => (
              <Card key={review.id}>
                <CardContent className="flex h-full flex-col">
                  <div className="flex items-start gap-3">
                    <Avatar name={review.customer_name || "Guest"} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="font-semibold text-dark-900">{review.customer_name || "Guest"}</h2>
                        <StarRating rating={review.rating} size="sm" />
                      </div>
                      {review.service_name && <p className="mt-1 text-xs font-bold uppercase tracking-[0.1em] text-primary-700">{review.service_name}</p>}
                    </div>
                  </div>

                  {review.comment ? (
                    <blockquote className="mt-5 flex-1 border-l-2 border-accent-300 pl-4 text-sm leading-7 text-dark-700">
                      “{review.comment}”
                    </blockquote>
                  ) : (
                    <p className="mt-5 flex-1 text-sm italic text-dark-500">Rating submitted without a written comment.</p>
                  )}

                  <p className="mt-5 border-t border-dark-200 pt-4 text-xs text-dark-500">
                    {new Date(review.created_at).toLocaleDateString("en-KE", { month: "long", day: "numeric", year: "numeric" })}
                    {review.staff_name && ` · Served by ${review.staff_name}`}
                  </p>
                </CardContent>
              </Card>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
