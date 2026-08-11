interface BookingSummaryCardProps {
  serviceName: string;
  date: string;
  time: string;
  price: number;
  staffName?: string;
  discountedPrice?: number;
}

export default function BookingSummaryCard({ serviceName, date, time, price, staffName, discountedPrice }: BookingSummaryCardProps) {
  const finalPrice = discountedPrice !== undefined && discountedPrice < price ? discountedPrice : price;
  const discounted = finalPrice < price;
  const formattedDate = new Date(`${date}T00:00:00`).toLocaleDateString("en-KE", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <aside className="overflow-hidden rounded-2xl border border-primary-200 bg-primary-50" aria-label="Booking summary">
      <div className="border-b border-primary-200 px-4 py-3">
        <p className="text-[0.66rem] font-bold uppercase tracking-[0.15em] text-primary-700">Appointment summary</p>
      </div>
      <dl className="grid gap-4 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-primary-700">Service</dt>
          <dd className="mt-1 font-semibold text-primary-900">{serviceName}</dd>
          {staffName && <dd className="mt-1 text-xs text-primary-700">With {staffName}</dd>}
        </div>
        <div>
          <dt className="text-xs text-primary-700">When</dt>
          <dd className="mt-1 font-semibold text-primary-900">{formattedDate}</dd>
          <dd className="mt-1 font-mono text-xs tabular-nums text-primary-700">{time}</dd>
        </div>
        <div className="border-t border-primary-200 pt-3 sm:col-span-2">
          <dt className="text-xs text-primary-700">Total</dt>
          <dd className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className="font-display text-2xl font-semibold tabular-nums text-primary-900">KES {Number(finalPrice).toLocaleString()}</span>
            {discounted && <span className="text-xs tabular-nums text-primary-500 line-through">KES {Number(price).toLocaleString()}</span>}
          </dd>
        </div>
      </dl>
    </aside>
  );
}
