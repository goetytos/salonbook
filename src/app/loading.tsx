import BrandMark from "@/components/brand/BrandMark";

export default function Loading() {
  return (
    <main id="main-content" className="min-h-screen bg-canvas" aria-busy="true">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <BrandMark />
        <div className="mt-20 grid gap-10 lg:grid-cols-2">
          <div>
            <div className="h-4 w-32 animate-pulse rounded bg-dark-200 motion-reduce:animate-none" />
            <div className="mt-7 h-14 max-w-lg animate-pulse rounded-xl bg-dark-200 motion-reduce:animate-none" />
            <div className="mt-3 h-14 max-w-md animate-pulse rounded-xl bg-dark-100 motion-reduce:animate-none" />
            <div className="mt-7 h-12 max-w-xl animate-pulse rounded-lg bg-dark-100 motion-reduce:animate-none" />
          </div>
          <div className="h-80 animate-pulse rounded-[2rem] bg-primary-100 motion-reduce:animate-none" />
        </div>
        <p className="sr-only" role="status">Loading SalonBook</p>
      </div>
    </main>
  );
}
