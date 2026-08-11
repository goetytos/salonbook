"use client";

import { useEffect } from "react";
import Link from "next/link";
import BrandMark from "@/components/brand/BrandMark";
import Button from "@/components/ui/Button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-canvas px-4 py-16">
      <div className="w-full max-w-lg rounded-[1.5rem] border border-dark-200 bg-surface p-7 shadow-[0_24px_70px_rgba(28,37,31,0.09)] sm:p-10">
        <BrandMark />
        <p className="mt-10 text-xs font-bold uppercase tracking-[0.18em] text-primary-700">Connection interrupted</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.035em] text-dark-900">
          We couldn&apos;t load this page.
        </h1>
        <p className="mt-4 leading-7 text-dark-600">
          Try the request again. If it still fails, return home and continue from there.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button onClick={reset}>Try again</Button>
          <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold text-dark-700 hover:bg-dark-50">
            Return home
          </Link>
        </div>
      </div>
    </main>
  );
}
