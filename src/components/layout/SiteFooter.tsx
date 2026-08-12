import Link from "next/link";
import BrandMark from "@/components/brand/BrandMark";

export default function SiteFooter() {
  return (
    <footer className="border-t border-dark-200 bg-primary-900 text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr] lg:px-8">
        <div>
          <BrandMark inverse />
          <p className="mt-4 max-w-sm text-sm leading-6 text-primary-200">
            A clearer way to discover salons and barbershops, compare services, and book across Kenya.
          </p>
        </div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-primary-300">For customers</h2>
          <div className="mt-4 grid gap-3 text-sm text-primary-100">
            <Link href="/explore" className="w-fit hover:text-white">Find a salon</Link>
            <Link href="/privacy" className="w-fit hover:text-white">How booking data is used</Link>
          </div>
        </div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-primary-300">For businesses</h2>
          <div className="mt-4 grid gap-3 text-sm text-primary-100">
            <Link href="/auth/signup" className="w-fit hover:text-white">List your business</Link>
            <Link href="/auth/login" className="w-fit hover:text-white">Business sign in</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-primary-300 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} SalonBook.</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <p>Built for appointment businesses across Kenya.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
