import Link from "next/link";
import BrandMark from "@/components/brand/BrandMark";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  panelEyebrow: string;
  panelTitle: string;
  panelDescription: string;
  highlights?: string[];
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function AuthShell({
  eyebrow,
  title,
  description,
  panelEyebrow,
  panelTitle,
  panelDescription,
  highlights = [],
  backHref = "/",
  backLabel = "Back to SalonBook",
  children,
  footer,
}: AuthShellProps) {
  return (
    <main id="main-content" className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[minmax(20rem,0.78fr)_minmax(0,1.22fr)]">
      <aside className="studio-grain relative overflow-hidden bg-primary-900 px-5 py-6 text-white sm:px-8 lg:flex lg:min-h-dvh lg:flex-col lg:justify-between lg:px-12 lg:py-10">
        <div className="absolute -right-24 top-1/4 h-64 w-64 rounded-full border border-white/10" aria-hidden="true" />
        <div className="absolute -right-6 top-[38%] h-32 w-32 rounded-full bg-accent-300/15 blur-2xl" aria-hidden="true" />

        <Link href="/" aria-label="SalonBook home" className="relative inline-flex rounded-lg">
          <BrandMark inverse />
        </Link>

        <div className="relative mt-12 max-w-lg pb-4 lg:mt-24 lg:pb-16">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-accent-300">{panelEyebrow}</p>
          <h2 className="mt-4 text-balance font-display text-3xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-4xl lg:text-5xl">
            {panelTitle}
          </h2>
          <p className="mt-5 max-w-md text-sm leading-7 text-primary-100 sm:text-base">{panelDescription}</p>

          {highlights.length > 0 && (
            <ul className="mt-8 hidden space-y-3 border-t border-white/15 pt-6 text-sm text-primary-50 sm:block">
              {highlights.map((highlight, index) => (
                <li key={highlight} className="grid grid-cols-[2rem_1fr] items-start gap-2">
                  <span className="font-mono text-xs font-bold text-accent-300" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="relative hidden text-xs leading-5 text-primary-200 lg:block">Appointments, teams and client care in one considered workspace.</p>
      </aside>

      <section className="studio-grid flex items-center px-4 py-10 sm:px-8 sm:py-14 lg:px-12">
        <div className="mx-auto w-full max-w-lg">
          <Link
            href={backHref}
            className="inline-flex min-h-11 items-center rounded-lg text-sm font-bold text-dark-600 transition-colors hover:text-primary-700"
          >
            <span aria-hidden="true">←</span>&nbsp; {backLabel}
          </Link>

          <div className="mt-8">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-primary-700">{eyebrow}</p>
            <h1 className="mt-3 text-balance font-display text-4xl font-semibold leading-[1.06] tracking-[-0.045em] text-dark-900 sm:text-5xl">{title}</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-dark-500 sm:text-base">{description}</p>
          </div>

          <div className="mt-8 rounded-[1.25rem] border border-dark-200 bg-surface p-5 shadow-[0_20px_60px_rgba(28,37,31,0.08)] sm:p-7">
            {children}
          </div>

          {footer && <div className="mt-5 text-center text-sm leading-6 text-dark-500">{footer}</div>}
        </div>
      </section>
    </main>
  );
}
