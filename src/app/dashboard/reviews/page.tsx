"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import Card, { CardContent, CardHeader } from "@/components/ui/Card";
import StarRating from "@/components/ui/StarRating";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";
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

  const fetchReviews = useCallback(async () => {
    if (!business) return;
    try {
      const result = await api.get<ReviewsResponse>(
        `/businesses/${business.id}/reviews`
      );
      setData(result);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [business]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  if (loading) return <p className="text-dark-400">Loading...</p>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark-900">Reviews</h1>
        <p className="text-dark-500 text-sm mt-1">See what customers are saying</p>
      </div>

      {/* Rating Summary */}
      {data && data.review_count > 0 && (
        <Card className="mb-6">
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-4xl font-bold text-dark-900">
                  {Number(data.avg_rating).toFixed(1)}
                </p>
                <StarRating rating={Math.round(data.avg_rating)} size="md" />
                <p className="text-sm text-dark-500 mt-1">
                  {data.review_count} review{data.review_count !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex-1">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = data.reviews.filter((r) => r.rating === star).length;
                  const pct = data.review_count > 0 ? (count / data.review_count) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-dark-500 w-3">{star}</span>
                      <div className="flex-1 h-2 bg-dark-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-dark-400 w-8">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reviews List */}
      {!data || data.reviews.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              }
              title="No reviews yet"
              description="Reviews will appear here when customers rate their experience."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.reviews.map((review) => (
            <Card key={review.id}>
              <CardContent>
                <div className="flex items-start gap-3">
                  <Avatar name={review.customer_name || "Guest"} size="md" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-dark-900">
                        {review.customer_name || "Guest"}
                      </p>
                      <StarRating rating={review.rating} size="sm" />
                    </div>
                    {review.service_name && (
                      <p className="text-xs text-dark-400 mb-1">{review.service_name}</p>
                    )}
                    {review.comment && (
                      <p className="text-sm text-dark-700">{review.comment}</p>
                    )}
                    <p className="text-xs text-dark-400 mt-2">
                      {new Date(review.created_at).toLocaleDateString("en-KE", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {review.staff_name && ` — served by ${review.staff_name}`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
