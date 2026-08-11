"use client";

import { useRef } from "react";
import type { KeyboardEvent } from "react";

interface StarRatingProps {
  rating: number;
  onChange?: (rating: number) => void;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  ariaLabel?: string;
}

export default function StarRating({
  rating,
  onChange,
  size = "md",
  showValue = false,
  ariaLabel = "Rating",
}: StarRatingProps) {
  const interactive = !!onChange;
  const sizes = { sm: "w-4 h-4", md: "w-5 h-5", lg: "w-6 h-6" };
  const sizeClass = sizes[size];
  const starRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const normalizedRating = Math.min(5, Math.max(0, rating));
  const selectedStar = normalizedRating > 0 ? Math.round(normalizedRating) : 0;
  const tabbableStar = selectedStar || 1;

  const selectStar = (star: number) => {
    const nextStar = Math.min(5, Math.max(1, star));
    onChange?.(nextStar);
    window.requestAnimationFrame(() => starRefs.current[nextStar - 1]?.focus());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, star: number) => {
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        event.preventDefault();
        selectStar(star - 1);
        break;
      case "ArrowRight":
      case "ArrowUp":
        event.preventDefault();
        selectStar(star + 1);
        break;
      case "Home":
        event.preventDefault();
        selectStar(1);
        break;
      case "End":
        event.preventDefault();
        selectStar(5);
        break;
    }
  };

  const stars = [1, 2, 3, 4, 5];

  if (!interactive) {
    return (
      <div
        className="inline-flex items-center gap-0.5"
        role="img"
        aria-label={`${normalizedRating.toFixed(1)} out of 5 stars`}
      >
        {stars.map((star) => (
          <svg
            key={star}
            className={`${sizeClass} ${star <= normalizedRating ? "text-yellow-400" : "text-dark-200"}`}
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
        {showValue && (
          <span className="ml-1 text-sm font-medium text-dark-600" aria-hidden="true">
            {normalizedRating.toFixed(1)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-0.5" role="radiogroup" aria-label={ariaLabel}>
      {stars.map((star, index) => (
        <button
          key={star}
          ref={(element) => {
            starRefs.current[index] = element;
          }}
          type="button"
          role="radio"
          aria-checked={selectedStar === star}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          tabIndex={tabbableStar === star ? 0 : -1}
          onClick={() => selectStar(star)}
          onKeyDown={(event) => handleKeyDown(event, star)}
          className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 motion-reduce:transform-none motion-reduce:transition-none"
        >
          <svg
            className={`${sizeClass} ${
              star <= normalizedRating ? "text-yellow-400" : "text-dark-200"
            }`}
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
      {showValue && (
        <span className="ml-1 text-sm font-medium text-dark-600">
          {normalizedRating.toFixed(1)}
        </span>
      )}
    </div>
  );
}
