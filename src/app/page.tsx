"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StudioHeroVisual from "@/components/brand/StudioHeroVisual";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";

const categoryLinks = [
  { label: "Hair salons", value: "hair-salon", detail: "Cuts, colour & care" },
  { label: "Barbershops", value: "barbershop", detail: "Fades, trims & grooming" },
  { label: "Braids & locks", value: "braids", detail: "Protective styles & maintenance" },
  { label: "Nail salons", value: "nail-salon", detail: "Manicures, colour & nail care" },
];

const bookingSteps = [
  {
    number: "01",
    title: "Find the right place",
    description: "Search by name, location or service category and compare businesses in one clear view.",
  },
  {
    number: "02",
    title: "Choose the details",
    description: "Review services, prices and customer feedback, then select a stylist, date and time.",
  },
  {
    number: "03",
    title: "Confirm without calling",
    description: "Share your contact details, check the appointment summary and reserve your slot online.",
  },
];

export default function LandingPage() {
  const [search, setSearch] = useState("");
  const router = useRouter();

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    const query = params.toString();
    router.push(`/explore${query ? `?${query}` : ""}`);
  };

  return (
    <div className="min-h-screen bg-canvas">
      <SiteHeader />

      <main id="main-content">
        <section className="relative overflow-hidden border-b border-dark-200">
          <div className="studio-grid absolute inset-0 opacity-45" aria-hidden="true" />
          <div className="absolute -left-32 top-20 h-80 w-80 rounded-full bg-primary-100/70 blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-28 lg:pt-24">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-surface/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-primary-800">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-500" aria-hidden="true" />
                Salon appointments, made clearer
              </p>

              <h1 className="mt-7 max-w-3xl text-balance font-display text-5xl font-semibold leading-[0.98] tracking-[-0.045em] text-dark-900 sm:text-6xl lg:text-[4.75rem]">
                Your next appointment is already within reach.
              </h1>
              <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-dark-600 sm:text-xl">
                Find salons and barbershops across Kenya, compare services and reviews, choose a stylist, and reserve a time that works.
              </p>

              <form onSubmit={handleSearch} className="mt-9 max-w-2xl" role="search">
                <label htmlFor="landing-search" className="sr-only">
                  Search by salon name or location
                </label>
                <div className="flex flex-col gap-3 rounded-2xl border border-dark-200 bg-surface p-2 shadow-[0_18px_50px_rgba(28,37,31,0.09)] sm:flex-row">
                  <div className="relative flex-1">
                    <svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-dark-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                      <circle cx="11" cy="11" r="7" strokeWidth="1.8" />
                      <path d="m16.5 16.5 4 4" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    <input
                      id="landing-search"
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Salon name or neighbourhood"
                      className="min-h-12 w-full rounded-xl border-0 bg-transparent py-3 pl-12 pr-4 text-base text-dark-900 placeholder:text-dark-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    />
                  </div>
                  <button type="submit" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary-900 px-6 text-sm font-bold text-white transition-colors hover:bg-primary-700">
                    Search SalonBook
                  </button>
                </div>
              </form>

              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="font-medium text-dark-500">Start with:</span>
                {categoryLinks.slice(0, 3).map((category) => (
                  <Link key={category.value} href={`/explore?category=${category.value}`} className="font-semibold text-primary-700 underline-offset-4 hover:underline">
                    {category.label}
                  </Link>
                ))}
              </div>
            </div>

            <StudioHeroVisual />
          </div>
        </section>

        <section aria-label="What you can do with SalonBook" className="border-b border-dark-200 bg-surface">
          <div className="mx-auto grid max-w-7xl divide-y divide-dark-200 px-4 sm:px-6 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-8">
            {[
              ["01", "Compare before you choose", "See services, prices and customer reviews."],
              ["02", "Pick the right appointment", "Choose a stylist and an available time."],
              ["03", "Keep the details together", "Review one clear summary before confirming."],
            ].map(([number, title, detail]) => (
              <div key={number} className="flex gap-4 py-7 md:px-7 md:first:pl-0 md:last:pr-0">
                <span className="font-mono text-xs font-bold text-primary-600">{number}</span>
                <div>
                  <h2 className="font-semibold text-dark-900">{title}</h2>
                  <p className="mt-1 text-sm leading-6 text-dark-500">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-700">How it works</p>
                <h2 className="mt-4 text-balance font-display text-4xl font-semibold leading-tight tracking-[-0.035em] text-dark-900 sm:text-5xl">
                  Less arranging. More certainty.
                </h2>
                <p className="mt-5 max-w-md leading-7 text-dark-600">
                  SalonBook keeps the decisions that matter—service, stylist, time and price—in one straightforward booking path.
                </p>
                <Link href="/explore" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg font-bold text-primary-700 underline-offset-4 hover:underline">
                  Browse salons
                  <span aria-hidden="true">→</span>
                </Link>
              </div>

              <ol className="border-t border-dark-300">
                {bookingSteps.map((step) => (
                  <li key={step.number} className="grid gap-3 border-b border-dark-300 py-7 sm:grid-cols-[4rem_1fr] sm:py-9">
                    <span className="font-mono text-sm font-bold text-primary-600">{step.number}</span>
                    <div className="grid gap-2 sm:grid-cols-[0.72fr_1fr] sm:gap-8">
                      <h3 className="text-lg font-semibold text-dark-900">{step.title}</h3>
                      <p className="leading-7 text-dark-600">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="bg-surface px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-700">Browse by category</p>
                <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.035em] text-dark-900 sm:text-5xl">Start with the service you need.</h2>
              </div>
              <Link href="/explore" className="inline-flex min-h-11 w-fit items-center gap-2 font-bold text-primary-700 hover:underline">
                View every salon <span aria-hidden="true">→</span>
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {categoryLinks.map((category, index) => (
                <Link
                  key={category.value}
                  href={`/explore?category=${category.value}`}
                  className={`group flex min-h-52 flex-col justify-between rounded-[1.25rem] border p-5 transition-transform hover:-translate-y-1 ${
                    index === 0
                      ? "border-primary-800 bg-primary-900 text-white"
                      : "border-dark-200 bg-canvas text-dark-900 hover:border-primary-300"
                  }`}
                >
                  <span className={`font-mono text-xs font-bold ${index === 0 ? "text-primary-300" : "text-primary-600"}`}>
                    0{index + 1}
                  </span>
                  <div>
                    <h3 className="font-display text-2xl font-semibold">{category.label}</h3>
                    <p className={`mt-2 text-sm ${index === 0 ? "text-primary-200" : "text-dark-500"}`}>{category.detail}</p>
                    <span className="mt-5 inline-block text-sm font-bold group-hover:underline">Browse category →</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] bg-primary-900 text-white lg:grid-cols-[1fr_0.8fr]">
            <div className="relative p-7 sm:p-12 lg:p-16">
              <div className="studio-grain absolute inset-0 opacity-60" aria-hidden="true" />
              <div className="relative">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-300">For salon and barbershop owners</p>
                <h2 className="mt-5 max-w-2xl text-balance font-display text-4xl font-semibold leading-tight tracking-[-0.035em] sm:text-5xl">
                  Put your schedule where customers can reach it.
                </h2>
                <p className="mt-5 max-w-xl leading-7 text-primary-100">
                  Publish services, organise staff and working hours, accept online bookings, and keep customer history in one place.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link href="/auth/signup" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-white px-6 text-sm font-bold text-primary-900 hover:bg-primary-50">
                    List your business
                  </Link>
                  <Link href="/auth/login" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/20 px-6 text-sm font-bold text-white hover:bg-white/10">
                    Business sign in
                  </Link>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 bg-white/5 p-7 sm:p-10 lg:border-l lg:border-t-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-300">A working day at a glance</p>
              <div className="mt-6 space-y-3">
                {[
                  ["09:00", "Haircut & finish", "Mumbi"],
                  ["11:30", "Loc maintenance", "Kevin"],
                  ["14:00", "Gel manicure", "Aisha"],
                ].map(([time, service, customer]) => (
                  <div key={time} className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
                    <span className="font-mono text-sm font-bold tabular-nums text-primary-200">{time}</span>
                    <span className="h-8 w-px bg-white/10" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold">{service}</p>
                      <p className="mt-0.5 text-xs text-primary-300">{customer}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
