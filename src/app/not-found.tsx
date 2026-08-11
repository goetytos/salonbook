import Link from "next/link";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-canvas">
      <SiteHeader />
      <main id="main-content" className="studio-grid flex min-h-[68dvh] items-center px-4 py-20">
        <div className="mx-auto w-full max-w-3xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary-700">404 · Page not found</p>
          <h1 className="mt-5 font-display text-5xl font-semibold tracking-[-0.04em] text-dark-900 sm:text-6xl">
            This appointment went missing.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-dark-600">
            The page may have moved or the link may be incomplete. Browse current salons or return to the homepage.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/explore" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-primary-900 px-6 text-sm font-bold text-white hover:bg-primary-700">
              Find a salon
            </Link>
            <Link href="/" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-dark-300 bg-surface px-6 text-sm font-bold text-dark-800 hover:bg-dark-50">
              Return home
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
