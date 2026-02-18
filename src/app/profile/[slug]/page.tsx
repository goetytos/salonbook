"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Tabs from "@/components/ui/Tabs";
import StarRating from "@/components/ui/StarRating";
import Avatar from "@/components/ui/Avatar";
import type { BusinessPublicProfile, Review } from "@/types";

export default function PublicProfilePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [profile, setProfile] = useState<BusinessPublicProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState("services");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/profile/${slug}`);
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        setProfile(data);

        // Fetch reviews
        const revRes = await fetch(`/api/businesses/${data.id}/reviews`);
        if (revRes.ok) {
          const revData = await revRes.json();
          setReviews(revData.reviews || []);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-50">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-50 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-dark-900 mb-2">Business not found</h1>
          <p className="text-dark-500">This profile doesn&apos;t exist or has been removed.</p>
          <Link href="/explore" className="text-primary-600 hover:text-primary-700 text-sm font-medium mt-4 inline-block">
            Browse all salons
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-50">
      {/* Cover Image Area */}
      <div
        className="h-48 bg-gradient-to-r from-primary-600 to-primary-700"
        style={
          profile.cover_image_url
            ? { backgroundImage: `url(${profile.cover_image_url})`, backgroundSize: "cover", backgroundPosition: "center" }
            : undefined
        }
      />

      {/* Profile Header */}
      <div className="max-w-3xl mx-auto px-4 -mt-12">
        <div className="bg-white rounded-xl border border-dark-200 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="-mt-16 sm:-mt-14">
              <div className="w-20 h-20 rounded-xl border-4 border-white bg-white shadow-sm overflow-hidden">
                <Avatar name={profile.name} src={profile.avatar_url} size="lg" />
              </div>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-dark-900">{profile.name}</h1>
              <p className="text-dark-500">{profile.location}</p>
              {profile.category && (
                <p className="text-sm text-dark-400 capitalize">
                  {profile.category.replace("-", " ")}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <StarRating rating={Math.round(profile.avg_rating)} size="sm" showValue />
                <span className="text-sm text-dark-500">
                  ({profile.review_count} review{profile.review_count !== 1 ? "s" : ""})
                </span>
              </div>
            </div>
            <Link
              href={`/book/${slug}`}
              className="inline-flex items-center justify-center px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition"
            >
              Book Now
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs Content */}
      <div className="max-w-3xl mx-auto px-4 mt-6 pb-12">
        <div className="bg-white rounded-xl border border-dark-200 overflow-hidden">
          <Tabs
            tabs={[
              { id: "services", label: "Services", count: profile.services.length },
              { id: "reviews", label: "Reviews", count: profile.review_count },
              { id: "about", label: "About" },
            ]}
            activeTab={tab}
            onChange={setTab}
          />

          <div className="p-6">
            {/* Services Tab */}
            {tab === "services" && (
              <div className="space-y-3">
                {profile.services.length === 0 ? (
                  <p className="text-dark-500 text-sm">No services listed yet.</p>
                ) : (
                  profile.services.map((service) => (
                    <div
                      key={service.id}
                      className="flex items-center justify-between py-3 border-b border-dark-100 last:border-b-0"
                    >
                      <div>
                        <h3 className="font-medium text-dark-900">{service.name}</h3>
                        <p className="text-sm text-dark-500">{service.duration_minutes} min</p>
                        {service.description && (
                          <p className="text-xs text-dark-400 mt-0.5">{service.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-primary-600">
                          KES {Number(service.price).toLocaleString()}
                        </span>
                        <Link
                          href={`/book/${slug}`}
                          className="text-xs font-medium text-primary-600 hover:text-primary-700"
                        >
                          Book
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Reviews Tab */}
            {tab === "reviews" && (
              <div className="space-y-4">
                {reviews.length === 0 ? (
                  <p className="text-dark-500 text-sm">No reviews yet.</p>
                ) : (
                  reviews.map((review) => (
                    <div key={review.id} className="flex items-start gap-3 pb-4 border-b border-dark-100 last:border-b-0">
                      <Avatar name={review.customer_name || "Guest"} size="sm" />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-dark-900 text-sm">
                            {review.customer_name || "Guest"}
                          </p>
                          <StarRating rating={review.rating} size="sm" />
                        </div>
                        {review.comment && (
                          <p className="text-sm text-dark-700">{review.comment}</p>
                        )}
                        <p className="text-xs text-dark-400 mt-1">
                          {new Date(review.created_at).toLocaleDateString("en-KE", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* About Tab */}
            {tab === "about" && (
              <div className="space-y-4">
                {profile.description ? (
                  <p className="text-dark-700">{profile.description}</p>
                ) : (
                  <p className="text-dark-400 text-sm">No description provided.</p>
                )}

                <div>
                  <h3 className="font-medium text-dark-900 mb-2">Contact</h3>
                  <p className="text-sm text-dark-700">{profile.phone}</p>
                  <p className="text-sm text-dark-700">{profile.location}</p>
                </div>

                {profile.staff && profile.staff.length > 0 && (
                  <div>
                    <h3 className="font-medium text-dark-900 mb-2">Our Team</h3>
                    <div className="flex flex-wrap gap-3">
                      {profile.staff.map((s) => (
                        <div key={s.id} className="flex items-center gap-2">
                          <Avatar name={s.name} src={s.avatar_url} size="sm" />
                          <div>
                            <p className="text-sm font-medium text-dark-900">{s.name}</p>
                            <p className="text-xs text-dark-400 capitalize">{s.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {profile.working_hours && (
                  <div>
                    <h3 className="font-medium text-dark-900 mb-2">Working Hours</h3>
                    <div className="space-y-1">
                      {Object.entries(profile.working_hours).map(([day, schedule]) => (
                        <div key={day} className="flex justify-between text-sm">
                          <span className="text-dark-700 capitalize">{day}</span>
                          <span className="text-dark-500">
                            {schedule.closed ? "Closed" : `${schedule.open} - ${schedule.close}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
