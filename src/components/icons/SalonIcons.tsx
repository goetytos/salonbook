interface IconProps {
  className?: string;
}

export function ScissorsIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  );
}

export function CombIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="2" width="4" height="20" rx="1" />
      <line x1="7" y1="5" x2="13" y2="5" />
      <line x1="7" y1="8" x2="13" y2="8" />
      <line x1="7" y1="11" x2="13" y2="11" />
      <line x1="7" y1="14" x2="13" y2="14" />
      <line x1="7" y1="17" x2="13" y2="17" />
    </svg>
  );
}

export function HairDryerIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12c0 3.5-2.5 6-6 6h-2l-2 4H8l1-4H7c-2.2 0-4-1.8-4-4s1.8-4 4-4h2l2-4h4l-1 4h2c3.5 0 6 2.5 6 6z" />
      <circle cx="16" cy="12" r="2" />
    </svg>
  );
}

export function RazorIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h10l-2 6H9L7 3z" />
      <rect x="9" y="9" width="6" height="12" rx="1" />
      <line x1="12" y1="9" x2="12" y2="3" />
    </svg>
  );
}

export function BarberPoleIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="20" rx="4" />
      <line x1="8" y1="6" x2="16" y2="10" />
      <line x1="8" y1="10" x2="16" y2="14" />
      <line x1="8" y1="14" x2="16" y2="18" />
      <circle cx="12" cy="4" r="0.5" fill="currentColor" />
      <circle cx="12" cy="20" r="0.5" fill="currentColor" />
    </svg>
  );
}

export function MirrorIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="10" r="7" />
      <line x1="12" y1="17" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
      <path d="M9 7.5a4 4 0 0 1 3-1.5" opacity="0.5" />
    </svg>
  );
}
