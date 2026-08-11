interface BrandMarkProps {
  inverse?: boolean;
  compact?: boolean;
  className?: string;
}

export default function BrandMark({
  inverse = false,
  compact = false,
  className = "",
}: BrandMarkProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[0.7rem] ${
          inverse ? "bg-white text-primary-900" : "bg-primary-900 text-white"
        }`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 36 36" className="h-9 w-9" fill="none">
          <path d="M8 8h10c5.5 0 10 4.5 10 10S23.5 28 18 28H8V8Z" fill="currentColor" opacity="0.16" />
          <path d="M10 10v16m0-8h9.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M20 10.5c4.2 1.1 6.3 3.6 6.3 7.5s-2.1 6.4-6.3 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="10" cy="10" r="1.6" fill="currentColor" />
          <circle cx="10" cy="26" r="1.6" fill="currentColor" />
        </svg>
      </span>
      {!compact && (
        <span className={`font-display text-[1.35rem] font-semibold tracking-[-0.025em] ${inverse ? "text-white" : "text-dark-900"}`}>
          SalonBook
        </span>
      )}
    </span>
  );
}
