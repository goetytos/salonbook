"use client";

interface TagProps {
  label: string;
  color?: string;
  onRemove?: () => void;
}

export default function Tag({ label, color = "#6B7280", onRemove }: TagProps) {
  return (
    <span
      className={`inline-flex min-h-11 items-center gap-1 rounded-full text-xs font-medium ${
        onRemove ? "pl-3" : "px-3"
      }`}
      style={{
        backgroundColor: `${color}20`,
        color: color,
        border: `1px solid ${color}40`,
      }}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-black/5 hover:opacity-70 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </span>
  );
}
