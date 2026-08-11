export default function StudioHeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[33rem]" aria-hidden="true">
      <div className="absolute -left-4 top-10 h-28 w-28 rounded-full border border-primary-700/20 bg-primary-100 sm:-left-10" />
      <div className="absolute -right-3 bottom-6 h-20 w-20 rotate-12 rounded-[1.5rem] bg-accent-200/80 sm:-right-8" />

      <div className="relative overflow-hidden rounded-[2rem] bg-primary-900 p-5 text-white shadow-[0_30px_80px_rgba(16,43,36,0.24)] sm:p-7">
        <div className="studio-grain absolute inset-0 opacity-70" />
        <div className="relative">
          <div className="flex items-center justify-between border-b border-white/10 pb-5">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-primary-200">Appointment preview</p>
              <p className="mt-1 font-display text-2xl font-semibold">Amani Studio</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-sm font-bold">AS</div>
          </div>

          <div className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-5">
            <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-accent-200 text-primary-900">
              <span className="text-[0.6rem] font-bold uppercase tracking-wider">Tue</span>
              <span className="text-lg font-bold leading-none">18</span>
            </div>
            <div>
              <p className="font-semibold">Knotless braids</p>
              <p className="mt-1 text-sm text-primary-200">10:30 · 3 hr · Westlands</p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/5">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeWidth="1.7" strokeLinecap="round" />
                <circle cx="12" cy="7" r="4" strokeWidth="1.7" />
              </svg>
            </div>
            <div>
              <p className="font-semibold">With Njeri</p>
              <p className="mt-1 text-sm text-primary-200">Braids &amp; natural hair</p>
            </div>
          </div>

          <div className="mt-7 flex items-end justify-between rounded-2xl bg-white px-4 py-4 text-primary-900">
            <div>
              <p className="text-xs font-medium text-dark-500">Appointment total</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums">KES 3,500</p>
            </div>
            <span className="rounded-lg bg-primary-100 px-3 py-2 text-xs font-bold text-primary-800">Ready to book</span>
          </div>
        </div>
      </div>

      <div className="relative -mt-4 ml-4 flex w-[calc(100%_-_2rem)] items-center justify-between rounded-2xl border border-dark-200 bg-surface px-4 py-3 shadow-[0_18px_50px_rgba(28,37,31,0.12)] sm:ml-12 sm:w-[calc(100%_-_6rem)]">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="m5 12 4 4L19 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <p className="text-xs font-semibold text-dark-900">One clear confirmation</p>
            <p className="text-[0.7rem] text-dark-500">Service, stylist, date and price</p>
          </div>
        </div>
        <span className="h-2 w-2 rounded-full bg-primary-500" />
      </div>
    </div>
  );
}
