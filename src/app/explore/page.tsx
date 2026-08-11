"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SearchBar from "@/components/ui/SearchBar";
import StarRating from "@/components/ui/StarRating";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";

interface DiscoverBusiness {
  id: string;
  name: string;
  slug: string;
  location: string;
  category?: string;
  avatar_url?: string;
  description?: string;
  avg_rating: number;
  review_count: number;
}

const categories = [
  { value: "", label: "All" },
  { value: "hair-salon", label: "Hair salons" },
  { value: "barbershop", label: "Barbershops" },
  { value: "nail-salon", label: "Nails" },
  { value: "spa", label: "Spa" },
  { value: "beauty-salon", label: "Beauty" },
  { value: "braids", label: "Braids & locks" },
  { value: "makeup", label: "Makeup" },
];

const validCategories = new Set(categories.map((category) => category.value));

function getCategoryLabel(value?: string) {
  return categories.find((category) => category.value === value)?.label || "Salon";
}

function SalonCard({ business }: { business: DiscoverBusiness }) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = business.name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const rating = Number.isFinite(Number(business.avg_rating)) ? Number(business.avg_rating) : 0;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-dark-200 bg-surface transition-all duration-200 hover:-translate-y-1 hover:border-primary-300 hover:shadow-[0_22px_60px_rgba(28,37,31,0.1)]">
      <div className="studio-grid relative flex min-h-32 items-end overflow-hidden bg-primary-100 p-4">
        <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full border-[18px] border-primary-200/70" aria-hidden="true" />
        <span className="absolute right-4 top-4 rounded-md bg-surface/90 px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-primary-800">
          {getCategoryLabel(business.category)}
        </span>
        <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-4 border-surface bg-primary-900 text-lg font-bold text-white shadow-sm">
          {business.avatar_url && !imageFailed ? (
            <img
              src={business.avatar_url}
              alt={`${business.name} logo`}
              width={64}
              height={64}
              loading="lazy"
              className="h-full w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            initials || "SB"
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex-1">
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-dark-900">{business.name}</h2>
          <p className="mt-1 text-sm text-dark-500">{business.location}</p>
          {business.description && (
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-dark-600">{business.description}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StarRating rating={Math.round(rating)} size="sm" />
            <span className="text-sm font-semibold tabular-nums text-dark-700">{rating.toFixed(1)}</span>
            <span className="text-sm text-dark-500">
              {business.review_count} review{business.review_count === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 border-t border-dark-200 pt-4">
          <Link href={`/profile/${business.slug}`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-dark-300 px-3 text-sm font-bold text-dark-800 hover:bg-dark-50">
            View salon
          </Link>
          <Link href={`/book/${business.slug}`} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary-900 px-3 text-sm font-bold text-white hover:bg-primary-700">
            Book
          </Link>
        </div>
      </div>
    </article>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading salons">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-[1.25rem] border border-dark-200 bg-surface">
          <div className="h-32 animate-pulse bg-primary-100 motion-reduce:animate-none" />
          <div className="space-y-3 p-5">
            <div className="h-5 w-3/5 animate-pulse rounded bg-dark-200 motion-reduce:animate-none" />
            <div className="h-4 w-2/5 animate-pulse rounded bg-dark-100 motion-reduce:animate-none" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-dark-100 motion-reduce:animate-none" />
            <div className="mt-5 h-11 animate-pulse rounded-lg bg-dark-100 motion-reduce:animate-none" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading salons</span>
    </div>
  );
}

function ExploreContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("q") || "";
  const requestedCategory = searchParams.get("category") || "";
  const urlCategory = validCategories.has(requestedCategory) ? requestedCategory : "";
  const currentParams = searchParams.toString();

  const [businesses, setBusinesses] = useState<DiscoverBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(urlSearch);
  const [category, setCategory] = useState(urlCategory);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setSearch(urlSearch);
    setCategory(urlCategory);
  }, [urlSearch, urlCategory]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextParams = new URLSearchParams(currentParams);
      if (search.trim()) nextParams.set("q", search.trim());
      else nextParams.delete("q");
      if (category) nextParams.set("category", category);
      else nextParams.delete("category");

      const nextQuery = nextParams.toString();
      if (nextQuery !== currentParams) {
        router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ""}`, { scroll: false });
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [category, currentParams, pathname, router, search]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (category) params.set("category", category);
      const query = params.toString();

      try {
        const response = await fetch(`/api/discover${query ? `?${query}` : ""}`, {
          signal: controller.signal,
        });
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            data && typeof data === "object" && "error" in data && typeof data.error === "string"
              ? data.error
              : "Salon discovery is temporarily unavailable."
          );
        }
        if (!Array.isArray(data)) throw new Error("Salon discovery returned an unexpected response.");
        setBusinesses(data);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setBusinesses([]);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Salon discovery is temporarily unavailable."
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [category, retryKey, search]);

  const activeCategoryLabel = useMemo(
    () => categories.find((item) => item.value === category)?.label,
    [category]
  );
  const hasFilters = Boolean(search.trim() || category);

  const clearFilters = () => {
    setSearch("");
    setCategory("");
  };

  return (
    <main id="main-content" className="min-h-[70dvh]">
      <section className="relative overflow-hidden bg-primary-900 px-4 py-12 text-white sm:px-6 sm:py-16 lg:px-8">
        <div className="studio-grain absolute inset-0 opacity-70" aria-hidden="true" />
        <div className="absolute -right-24 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full border-[40px] border-white/5" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-300">Salon discovery</p>
          <div className="mt-4 grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <h1 className="font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Find your next salon.</h1>
              <p className="mt-3 max-w-xl leading-7 text-primary-100">
                Search businesses across Kenya and compare their services, locations and customer reviews.
              </p>
            </div>
            <SearchBar
              value={search}
              onChange={setSearch}
              label="Search salons by name or location"
              placeholder="Search by salon name or location"
              className="rounded-xl bg-white shadow-[0_18px_50px_rgba(0,0,0,0.16)] [&_input]:border-0 [&_input]:bg-white"
            />
          </div>
        </div>
      </section>

      <section className="border-b border-dark-200 bg-surface" aria-label="Filter salons by category">
        <div className="mx-auto max-w-7xl overflow-x-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-max gap-2" role="group" aria-label="Salon categories">
            {categories.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setCategory(item.value)}
                aria-pressed={category === item.value}
                className={`inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold transition-colors ${
                  category === item.value
                    ? "bg-primary-900 text-white"
                    : "border border-dark-200 bg-surface text-dark-600 hover:border-primary-300 hover:text-primary-800"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8" aria-labelledby="salon-results-heading" aria-busy={loading}>
        <div className="mx-auto max-w-7xl">
          <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-700">Results</p>
              <h2 id="salon-results-heading" className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em] text-dark-900">
                {activeCategoryLabel && category ? activeCategoryLabel : "Salons and barbershops"}
              </h2>
            </div>
            {!loading && !error && (
              <p className="text-sm text-dark-500" role="status" aria-live="polite">
                {businesses.length} result{businesses.length === 1 ? "" : "s"}
                {search.trim() ? ` for “${search.trim()}”` : ""}
              </p>
            )}
          </div>

          {loading ? (
            <ResultsSkeleton />
          ) : error ? (
            <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-6 sm:flex sm:items-center sm:justify-between sm:gap-6" role="alert">
              <div>
                <h3 className="font-semibold text-red-900">We couldn&apos;t load salons.</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-red-700">{error}</p>
              </div>
              <button type="button" onClick={() => setRetryKey((key) => key + 1)} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-red-700 px-5 text-sm font-bold text-white hover:bg-red-800 sm:mt-0">
                Try again
              </button>
            </div>
          ) : businesses.length === 0 ? (
            <div className="studio-grid rounded-[1.5rem] border border-dark-200 bg-surface px-6 py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-700" aria-hidden="true">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="11" cy="11" r="7" strokeWidth="1.8" />
                  <path d="m16.5 16.5 4 4" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="mt-5 font-display text-2xl font-semibold text-dark-900">No matching salons yet.</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-dark-600">
                Try a broader name or location, or clear the selected category to see every available business.
              </p>
              {hasFilters && (
                <button type="button" onClick={clearFilters} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary-900 px-5 text-sm font-bold text-white hover:bg-primary-700">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {businesses.map((business) => (
                <SalonCard key={business.id} business={business} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function ExploreFallback() {
  return (
    <main id="main-content" className="min-h-[70dvh] px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 h-28 animate-pulse rounded-[1.5rem] bg-primary-100 motion-reduce:animate-none" />
        <ResultsSkeleton />
      </div>
    </main>
  );
}

export default function ExplorePage() {
  return (
    <div className="min-h-screen bg-canvas">
      <SiteHeader />
      <Suspense fallback={<ExploreFallback />}>
        <ExploreContent />
      </Suspense>
      <SiteFooter />
    </div>
  );
}
