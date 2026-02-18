"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LandingPage() {
  const [search, setSearch] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/explore${search ? `?q=${encodeURIComponent(search)}` : ""}`);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-dark-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">SB</span>
              </div>
              <span className="text-xl font-bold text-dark-900">SalonBook</span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/explore"
                className="text-sm font-medium text-dark-600 hover:text-dark-900 transition"
              >
                Explore
              </Link>
              <Link
                href="/customer/auth/login"
                className="text-sm font-medium text-dark-600 hover:text-dark-900 transition"
              >
                Customer Login
              </Link>
              <Link
                href="/auth/login"
                className="text-sm font-medium text-dark-600 hover:text-dark-900 transition"
              >
                Owner Login
              </Link>
              <Link
                href="/auth/signup"
                className="text-sm font-medium bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-6xl font-bold text-dark-900 tracking-tight">
              Manage your salon.
              <br />
              <span className="text-primary-600">Accept bookings online.</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-dark-500 max-w-2xl mx-auto">
              SalonBook helps salons and barber shops in Kenya manage appointments,
              services, and customers — all in one place. Your clients book online,
              you focus on what you do best.
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="mt-8 max-w-lg mx-auto">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search for a salon near you..."
                    className="w-full pl-10 pr-4 py-3 border border-dark-200 rounded-lg text-dark-900 placeholder:text-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <button
                  type="submit"
                  className="px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition"
                >
                  Search
                </button>
              </div>
            </form>

            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center px-8 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition text-base"
              >
                List Your Business
              </Link>
              <Link
                href="/explore"
                className="inline-flex items-center justify-center px-8 py-3 border border-dark-200 text-dark-700 font-medium rounded-lg hover:bg-dark-50 transition text-base"
              >
                Browse Salons
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-dark-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-dark-900">
              Everything you need to run your salon
            </h2>
            <p className="mt-4 text-lg text-dark-500">
              Professional tools built for Kenyan salons and barber shops.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "Online Booking",
                desc: "Clients book appointments from their phone. No calls needed. Share your booking link on social media.",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ),
              },
              {
                title: "Staff Management",
                desc: "Add your team, assign services, set individual working hours. Customers can choose their stylist.",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ),
              },
              {
                title: "Reviews & Ratings",
                desc: "Build trust with customer reviews. Showcase your rating on your public profile.",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                ),
              },
              {
                title: "Client CRM",
                desc: "Notes, tags, booking history — know your customers. Track VIPs and regulars.",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ),
              },
              {
                title: "Promotions",
                desc: "Create promo codes with discounts. Drive bookings during slow periods.",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                ),
              },
              {
                title: "Analytics",
                desc: "Track revenue, bookings, popular services, and peak hours. Make data-driven decisions.",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-xl border border-dark-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-lg flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-dark-900 mb-2">{feature.title}</h3>
                <p className="text-dark-500 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-primary-600 rounded-2xl px-8 py-16 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to grow your salon?
            </h2>
            <p className="text-primary-100 text-lg mb-8 max-w-xl mx-auto">
              Join salons across Kenya already using SalonBook to manage
              appointments and grow their business.
            </p>
            <Link
              href="/auth/signup"
              className="inline-flex items-center px-8 py-3 bg-white text-primary-700 font-semibold rounded-lg hover:bg-primary-50 transition"
            >
              Get Started — It&apos;s Free
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-dark-100 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary-600 rounded flex items-center justify-center">
                <span className="text-white font-bold text-xs">SB</span>
              </div>
              <span className="text-sm text-dark-500">SalonBook</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-dark-400">
              <Link href="/explore" className="hover:text-dark-600">Explore Salons</Link>
              <Link href="/auth/signup" className="hover:text-dark-600">For Business Owners</Link>
            </div>
            <p className="text-sm text-dark-400">
              Built for salons and barber shops in Kenya.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
