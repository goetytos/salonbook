export default function SalonHeroGraphic({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Decorative circle backdrop */}
      <circle cx="200" cy="150" r="120" fill="url(#heroGrad1)" opacity="0.15" />
      <circle cx="200" cy="150" r="85" fill="url(#heroGrad2)" opacity="0.1" />

      {/* Salon chair */}
      <g transform="translate(140, 80)">
        {/* Chair back */}
        <path
          d="M30 20C30 12 38 0 60 0C82 0 90 12 90 20V80H30V20Z"
          fill="var(--color-primary-700, #047857)"
          opacity="0.9"
        />
        {/* Chair seat */}
        <rect x="20" y="80" width="80" height="20" rx="4" fill="var(--color-primary-600, #059669)" />
        {/* Chair base */}
        <rect x="52" y="100" width="16" height="40" rx="2" fill="var(--color-dark-400, #94a3b8)" />
        {/* Chair foot */}
        <ellipse cx="60" cy="145" rx="30" ry="6" fill="var(--color-dark-300, #cbd5e1)" />
        {/* Armrests */}
        <rect x="10" y="60" width="14" height="30" rx="4" fill="var(--color-primary-800, #065f46)" />
        <rect x="96" y="60" width="14" height="30" rx="4" fill="var(--color-primary-800, #065f46)" />
      </g>

      {/* Scissors — right side */}
      <g transform="translate(280, 60) rotate(25)">
        <circle cx="10" cy="10" r="8" stroke="var(--color-accent-500, #f59e0b)" strokeWidth="2.5" fill="none" />
        <circle cx="10" cy="34" r="8" stroke="var(--color-accent-500, #f59e0b)" strokeWidth="2.5" fill="none" />
        <line x1="10" y1="18" x2="10" y2="26" stroke="var(--color-accent-500, #f59e0b)" strokeWidth="2.5" />
        <line x1="10" y1="22" x2="30" y2="4" stroke="var(--color-accent-500, #f59e0b)" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="10" y1="22" x2="30" y2="40" stroke="var(--color-accent-500, #f59e0b)" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* Comb — left side */}
      <g transform="translate(50, 100) rotate(-10)">
        <rect x="0" y="0" width="10" height="50" rx="2" fill="var(--color-accent-400, #fbbf24)" opacity="0.8" />
        <line x1="10" y1="8" x2="22" y2="8" stroke="var(--color-accent-400, #fbbf24)" strokeWidth="2" opacity="0.8" />
        <line x1="10" y1="15" x2="22" y2="15" stroke="var(--color-accent-400, #fbbf24)" strokeWidth="2" opacity="0.8" />
        <line x1="10" y1="22" x2="22" y2="22" stroke="var(--color-accent-400, #fbbf24)" strokeWidth="2" opacity="0.8" />
        <line x1="10" y1="29" x2="22" y2="29" stroke="var(--color-accent-400, #fbbf24)" strokeWidth="2" opacity="0.8" />
        <line x1="10" y1="36" x2="22" y2="36" stroke="var(--color-accent-400, #fbbf24)" strokeWidth="2" opacity="0.8" />
        <line x1="10" y1="43" x2="22" y2="43" stroke="var(--color-accent-400, #fbbf24)" strokeWidth="2" opacity="0.8" />
      </g>

      {/* Mirror — top left */}
      <g transform="translate(80, 30)">
        <circle cx="20" cy="20" r="18" stroke="var(--color-primary-300, #6ee7b7)" strokeWidth="2" fill="none" opacity="0.6" />
        <line x1="20" y1="38" x2="20" y2="50" stroke="var(--color-primary-300, #6ee7b7)" strokeWidth="2" opacity="0.6" />
        <line x1="12" y1="50" x2="28" y2="50" stroke="var(--color-primary-300, #6ee7b7)" strokeWidth="2" opacity="0.6" />
      </g>

      {/* Sparkle dots */}
      <circle cx="320" cy="180" r="4" fill="var(--color-accent-400, #fbbf24)" opacity="0.6" />
      <circle cx="340" cy="160" r="2.5" fill="var(--color-accent-300, #fcd34d)" opacity="0.5" />
      <circle cx="310" cy="200" r="3" fill="var(--color-primary-300, #6ee7b7)" opacity="0.5" />
      <circle cx="70" cy="200" r="3" fill="var(--color-accent-400, #fbbf24)" opacity="0.5" />
      <circle cx="90" cy="220" r="2" fill="var(--color-primary-400, #34d399)" opacity="0.4" />
      <circle cx="350" cy="120" r="2" fill="var(--color-accent-300, #fcd34d)" opacity="0.4" />

      {/* Star sparkle */}
      <g transform="translate(330, 90)">
        <line x1="0" y1="6" x2="0" y2="-6" stroke="var(--color-accent-400, #fbbf24)" strokeWidth="2" strokeLinecap="round" />
        <line x1="-6" y1="0" x2="6" y2="0" stroke="var(--color-accent-400, #fbbf24)" strokeWidth="2" strokeLinecap="round" />
        <line x1="-4" y1="-4" x2="4" y2="4" stroke="var(--color-accent-400, #fbbf24)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="4" y1="-4" x2="-4" y2="4" stroke="var(--color-accent-400, #fbbf24)" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* Barber pole stripes — bottom right */}
      <g transform="translate(310, 210)">
        <rect x="0" y="0" width="16" height="50" rx="8" stroke="var(--color-primary-400, #34d399)" strokeWidth="1.5" fill="none" opacity="0.4" />
        <line x1="0" y1="12" x2="16" y2="20" stroke="var(--color-primary-400, #34d399)" strokeWidth="1.5" opacity="0.3" />
        <line x1="0" y1="22" x2="16" y2="30" stroke="var(--color-primary-400, #34d399)" strokeWidth="1.5" opacity="0.3" />
        <line x1="0" y1="32" x2="16" y2="40" stroke="var(--color-primary-400, #34d399)" strokeWidth="1.5" opacity="0.3" />
      </g>

      <defs>
        <radialGradient id="heroGrad1" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="var(--color-primary-400, #34d399)" />
          <stop offset="100%" stopColor="var(--color-primary-600, #059669)" />
        </radialGradient>
        <radialGradient id="heroGrad2" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="var(--color-accent-300, #fcd34d)" />
          <stop offset="100%" stopColor="var(--color-accent-500, #f59e0b)" />
        </radialGradient>
      </defs>
    </svg>
  );
}
