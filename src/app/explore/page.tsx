"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SearchBar from "@/components/ui/SearchBar";
import BusinessCard from "@/components/booking/BusinessCard";

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

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "hair-salon", label: "Hair Salon" },
  { value: "barbershop", label: "Barbershop" },
  { value: "nail-salon", label: "Nail Salon" },
  { value: "spa", label: "Spa" },
  { value: "beauty-salon", label: "Beauty" },
  { value: "braids", label: "Braids" },
  { value: "makeup", label: "Makeup" },
];

export default function ExplorePage() {
  const [businesses, setBusinesses] = useState<DiscoverBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (category) params.set("category", category);
    const qs = params.toString() ? `?${params.toString()}` : "";

    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/discover${qs}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setBusinesses(data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300); // debounce

    return () => clearTimeout(timer);
  }, [search, category]);

  return (
    <div className="min-h-screen bg-dark-50">
      {/* Nav */}
      <nav className="bg-white border-b border-dark-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">SB</span>
              </div>
              <span className="text-xl font-bold text-dark-900">SalonBook</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="/customer/auth/login"
                className="text-sm font-medium text-dark-600 hover:text-dark-900"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="text-sm font-medium bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
              >
                List Your Business
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-dark-900">Find a Salon</h1>
          <p className="text-dark-500 mt-2">
            Discover and book with the best salons and barber shops in Kenya
          </p>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by name or location..."
            className="flex-1"
          />
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  category === cat.value
                    ? "bg-primary-600 text-white"
                    : "bg-white border border-dark-200 text-dark-600 hover:border-primary-300"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <p className="text-dark-400">Searching...</p>
        ) : businesses.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-dark-500 text-lg">No salons found</p>
            <p className="text-dark-400 text-sm mt-1">
              Try a different search or category
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {businesses.map((biz) => (
              <BusinessCard
                key={biz.id}
                name={biz.name}
                slug={biz.slug}
                location={biz.location}
                category={biz.category}
                avatar_url={biz.avatar_url}
                avg_rating={Number(biz.avg_rating)}
                review_count={biz.review_count}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
