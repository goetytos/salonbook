import Link from "next/link";
import BrandMark from "@/components/brand/BrandMark";

export default function LegalPage({
  eyebrow,
  title,
  summary,
  children,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-dark-200 bg-surface">
        <nav className="mx-auto flex min-h-18 max-w-4xl items-center justify-between gap-4 px-4 sm:px-6" aria-label="Legal navigation">
          <Link href="/" aria-label="SalonBook home" className="rounded-lg"><BrandMark /></Link>
          <Link href="/" className="inline-flex min-h-11 items-center text-sm font-bold text-primary-700 hover:underline"><span aria-hidden="true">←</span>&nbsp; Back home</Link>
        </nav>
      </header>
      <main id="main-content" className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <header className="border-b border-dark-200 pb-8">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-primary-700">{eyebrow}</p>
          <h1 className="mt-3 text-balance font-display text-4xl font-semibold tracking-[-0.04em] text-dark-900 sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-dark-600">{summary}</p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-dark-400">Last updated 12 August 2026</p>
        </header>
        <article className="legal-copy py-8 text-sm leading-7 text-dark-700">{children}</article>
      </main>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-9">
      <h2 className="font-display text-2xl font-semibold tracking-[-0.025em] text-dark-900">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
