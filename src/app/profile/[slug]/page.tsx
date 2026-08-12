"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import DashboardState from "@/components/dashboard/DashboardState";
import Avatar from "@/components/ui/Avatar";
import StarRating from "@/components/ui/StarRating";
import Tabs from "@/components/ui/Tabs";
import type { BusinessPublicProfile, Review } from "@/types";

function safeImageSource(value?: string) {
  if (!value) return null;
  if (value.startsWith("/")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

function safeExternalLink(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export default function PublicProfilePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [profile, setProfile] = useState<BusinessPublicProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewsError, setReviewsError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const [tab, setTab] = useState("services");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    setReviewsError("");
    setNotFound(false);
    setCoverFailed(false);
    try {
      const previewRequested = new URLSearchParams(window.location.search).get("preview") === "1";
      const response = await fetch(`/api/profile/${slug}${previewRequested ? "?preview=1" : ""}`, {
        credentials: "same-origin",
      });
      if (response.status === 404) {
        setNotFound(true);
        setProfile(null);
        return;
      }
      if (!response.ok) throw new Error("This studio profile could not be loaded.");
      const data = await response.json() as BusinessPublicProfile;
      setProfile(data);

      if (data.preview_mode) {
        setReviews([]);
        return;
      }

      try {
        const reviewsResponse = await fetch(`/api/businesses/${data.id}/reviews`);
        if (!reviewsResponse.ok) throw new Error("Reviews could not be loaded.");
        const reviewsData = await reviewsResponse.json();
        setReviews(Array.isArray(reviewsData.reviews) ? reviewsData.reviews : []);
      } catch (requestError) {
        setReviews([]);
        setReviewsError(requestError instanceof Error ? requestError.message : "Reviews could not be loaded.");
      }
    } catch (requestError) {
      setProfile(null);
      setError(requestError instanceof Error ? requestError.message : "This studio profile could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-canvas">
        <SiteHeader />
        <main id="main-content" className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8"><DashboardState type="loading" title="Loading studio profile" /></main>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-dvh bg-canvas">
        <SiteHeader />
        <main id="main-content" className="studio-grid flex min-h-[70dvh] items-center justify-center px-4 py-16">
          <div className="max-w-xl rounded-[1.4rem] border border-dark-200 bg-surface p-8 text-center shadow-[0_20px_60px_rgba(28,37,31,0.08)]">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-primary-700">Profile unavailable</p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] text-dark-900">This studio isn’t listed.</h1>
            <p className="mt-4 text-sm leading-6 text-dark-500">The booking profile may have moved or been removed.</p>
            <Link href="/explore" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary-900 px-4 text-sm font-bold text-white hover:bg-primary-700">Browse studios</Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-dvh bg-canvas">
        <SiteHeader />
        <main id="main-content" className="mx-auto min-h-[70dvh] max-w-4xl px-4 py-12 sm:px-6 lg:px-8"><DashboardState type="error" title="Studio profile unavailable" description={error || "No profile data was returned."} onRetry={() => void loadProfile()} /></main>
        <SiteFooter />
      </div>
    );
  }

  const coverSource = safeImageSource(profile.cover_image_url);
  const avatarSource = safeImageSource(profile.avatar_url) || undefined;
  const socialLinks = Object.entries(profile.social_links || {}).flatMap(
    ([network, value]) => {
      const url = safeExternalLink(value);
      return url ? [{ network, url }] : [];
    }
  );

  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />
      <main id="main-content">
        {profile.preview_mode && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900" role="status">
            <strong>Private owner preview.</strong> Customers cannot see or book this listing until setup is complete and an administrator activates it.
          </div>
        )}
        <section className="relative isolate h-64 overflow-hidden bg-primary-900 sm:h-80" aria-label={`${profile.name} cover`}>
          {coverSource && !coverFailed && (
            <Image
              src={coverSource}
              alt={`${profile.name} studio cover`}
              fill
              unoptimized
              priority
              sizes="100vw"
              className="object-cover"
              onError={() => setCoverFailed(true)}
            />
          )}
          <div className={`absolute inset-0 ${coverSource && !coverFailed ? "bg-[linear-gradient(180deg,rgba(16,43,36,0.12),rgba(16,43,36,0.76))]" : "bg-[radial-gradient(circle_at_72%_18%,rgba(216,185,120,0.42),transparent_28%),linear-gradient(125deg,var(--color-primary-900),var(--color-primary-600))]"}`} aria-hidden="true" />
          <div className="studio-grain absolute inset-0 opacity-60" aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-5xl px-4 pb-6 text-white sm:px-6 lg:px-8">
            <Link href="/explore" className="inline-flex min-h-11 items-center rounded-lg text-sm font-bold text-white hover:underline"><span aria-hidden="true">←</span>&nbsp; Back to discovery</Link>
          </div>
        </section>

        <div className="relative z-10 mx-auto -mt-7 max-w-5xl px-4 sm:-mt-10 sm:px-6 lg:px-8">
          <section className="rounded-[1.35rem] border border-dark-200 bg-surface p-5 shadow-[0_20px_60px_rgba(28,37,31,0.12)] sm:p-7" aria-labelledby="profile-title">
            <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-end lg:grid-cols-[auto_1fr_auto]">
              <div className="-mt-12 rounded-[1.1rem] border-4 border-surface bg-surface shadow-lg sm:-mt-16">
                <Avatar name={profile.name} src={avatarSource} size="lg" />
              </div>
              <div className="min-w-0">
                {profile.category && <p className="text-[0.66rem] font-bold uppercase tracking-[0.15em] text-primary-700">{profile.category.replace("-", " ")}</p>}
                <h1 id="profile-title" className="mt-1 text-balance font-display text-3xl font-semibold tracking-[-0.04em] text-dark-900 sm:text-4xl">{profile.name}</h1>
                <p className="mt-2 text-sm text-dark-500">{profile.location}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StarRating rating={Number(profile.avg_rating)} size="sm" />
                  <span className="text-sm text-dark-500">{Number(profile.avg_rating).toFixed(1)} · {profile.review_count} review{profile.review_count === 1 ? "" : "s"}</span>
                </div>
              </div>
              {profile.preview_mode ? (
                <Link href="/dashboard/settings" className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-primary-300 bg-primary-50 px-6 text-sm font-bold text-primary-800 hover:bg-primary-100 sm:col-span-2 lg:col-span-1 lg:w-auto">Return to setup</Link>
              ) : (
                <Link href={`/book/${slug}`} className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-primary-900 px-6 text-sm font-bold text-white shadow-[0_10px_24px_rgba(16,43,36,0.18)] hover:bg-primary-700 sm:col-span-2 lg:col-span-1 lg:w-auto">Book an appointment</Link>
              )}
            </div>
          </section>
        </div>

        <div className="mx-auto max-w-5xl px-4 pb-16 pt-7 sm:px-6 lg:px-8">
          <section className="overflow-hidden rounded-[1.25rem] border border-dark-200 bg-surface" aria-label={`${profile.name} information`}>
            <div className="border-b border-dark-200 px-2 sm:px-4">
              <Tabs
                ariaLabel="Studio profile sections"
                tabs={[
                  { id: "services", label: "Services", count: profile.services.length },
                  { id: "reviews", label: "Reviews", count: profile.review_count },
                  { id: "about", label: "About" },
                ]}
                activeTab={tab}
                onChange={setTab}
              />
            </div>

            <div className="p-4 sm:p-7">
              {tab === "services" && (
                <section aria-label="Services">
                  {profile.services.length === 0 ? (
                    <DashboardState title="No services listed yet" description="This studio is still preparing its public service menu." />
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {profile.services.map((service) => (
                        <article key={service.id} className="flex h-full flex-col rounded-2xl border border-dark-200 bg-dark-50/55 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div><h2 className="font-display text-xl font-semibold text-dark-900">{service.name}</h2><p className="mt-1 text-xs font-bold uppercase tracking-[0.1em] text-dark-500">{service.duration_minutes} minutes</p></div>
                            <p className="shrink-0 font-bold tabular-nums text-primary-700">KES {Number(service.price).toLocaleString()}</p>
                          </div>
                          {service.description && <p className="mt-3 flex-1 text-sm leading-6 text-dark-600">{service.description}</p>}
                          {!profile.preview_mode && <Link href={`/book/${slug}`} className="mt-5 inline-flex min-h-11 w-fit items-center rounded-lg text-sm font-bold text-primary-700 hover:underline">Book this service <span aria-hidden="true">→</span></Link>}
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {tab === "reviews" && (
                <section aria-label="Customer reviews">
                  {reviewsError ? (
                    <DashboardState type="error" title="Reviews unavailable" description={reviewsError} onRetry={() => void loadProfile()} />
                  ) : reviews.length === 0 ? (
                    <DashboardState title="No reviews yet" description="Customer feedback will appear here after completed visits." />
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {reviews.map((review) => (
                        <article key={review.id} className="flex h-full flex-col rounded-2xl border border-dark-200 p-4">
                          <div className="flex items-start gap-3"><Avatar name={review.customer_name || "Guest"} size="sm" /><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold text-dark-900">{review.customer_name || "Guest"}</h2><div className="mt-1"><StarRating rating={review.rating} size="sm" /></div></div></div>
                          {review.comment ? <blockquote className="mt-4 flex-1 border-l-2 border-accent-300 pl-3 text-sm leading-6 text-dark-700">“{review.comment}”</blockquote> : <p className="mt-4 flex-1 text-sm italic text-dark-500">Rating submitted without a comment.</p>}
                          <p className="mt-4 border-t border-dark-200 pt-3 text-xs text-dark-400">{new Date(review.created_at).toLocaleDateString("en-KE", { month: "long", day: "numeric", year: "numeric" })}</p>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {tab === "about" && (
                <section className="grid gap-7 lg:grid-cols-[1fr_0.85fr]" aria-label="About this studio">
                  <div>
                    <p className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-primary-700">The studio</p>
                    <h2 className="mt-2 font-display text-2xl font-semibold text-dark-900">About {profile.name}</h2>
                    <p className={`mt-4 text-sm leading-7 ${profile.description ? "text-dark-700" : "italic text-dark-500"}`}>{profile.description || "This studio has not added a description yet."}</p>

                    <div className="mt-7 rounded-2xl bg-primary-50 p-4">
                      <h3 className="font-semibold text-primary-900">Contact and location</h3>
                      <a href={`tel:${profile.phone}`} className="mt-3 block min-h-11 text-sm font-bold text-primary-700 hover:underline">{profile.phone}</a>
                      <p className="text-sm text-primary-800">{profile.location}</p>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.location)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-primary-700 hover:underline"
                      >
                        Get directions <span aria-hidden="true">↗</span>
                      </a>
                    </div>

                    {socialLinks.length > 0 && (
                      <div className="mt-5 flex flex-wrap gap-2" aria-label={`${profile.name} links`}>
                        {socialLinks.map(({ network, url }) => (
                          <a key={network} href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-dark-200 px-3 text-sm font-bold capitalize text-primary-700 hover:bg-primary-50">
                            {network} <span aria-hidden="true">↗</span>
                          </a>
                        ))}
                      </div>
                    )}

                    {profile.staff.length > 0 && (
                      <div className="mt-7">
                        <h3 className="font-semibold text-dark-900">The team</h3>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {profile.staff.map((staffMember) => (
                            <div key={staffMember.id} className="flex items-center gap-3 rounded-xl border border-dark-200 p-3">
                              <Avatar name={staffMember.name} src={safeImageSource(staffMember.avatar_url) || undefined} size="sm" />
                              <div><p className="text-sm font-semibold text-dark-900">{staffMember.name}</p><p className="mt-0.5 text-xs capitalize text-dark-500">{staffMember.role}</p></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-dark-200 bg-dark-50/60 p-4 sm:p-5">
                    <h3 className="font-display text-xl font-semibold text-dark-900">Working hours</h3>
                    <dl className="mt-4 divide-y divide-dark-200">
                      {Object.entries(profile.working_hours).map(([day, schedule]) => (
                        <div key={day} className="flex min-h-11 items-center justify-between gap-4 py-2 text-sm">
                          <dt className="font-semibold capitalize text-dark-700">{day}</dt>
                          <dd className={schedule.closed ? "text-dark-400" : "font-mono tabular-nums text-dark-600"}>{schedule.closed ? "Closed" : `${schedule.open} – ${schedule.close}`}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </section>
              )}
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
