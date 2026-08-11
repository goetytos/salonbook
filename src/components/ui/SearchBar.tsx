"use client";

import { useId } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  className = "",
  label = "Search",
}: SearchBarProps) {
  const inputId = useId();

  return (
    <div className={`relative ${className}`}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <svg
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-11 w-full pl-10 pr-4 py-2 border border-dark-200 rounded-lg text-sm text-dark-900 placeholder:text-dark-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-primary-500"
      />
    </div>
  );
}
