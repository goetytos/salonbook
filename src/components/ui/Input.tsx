"use client";

import { InputHTMLAttributes, forwardRef, useId } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      className = "",
      id,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const describedBy = [ariaDescribedBy, error ? errorId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-dark-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-describedby={describedBy}
          aria-invalid={error ? true : ariaInvalid}
          className={`
            min-h-11 w-full px-3 py-2 border rounded-lg text-dark-900
            placeholder:text-dark-400
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-primary-500
            disabled:bg-dark-50 disabled:cursor-not-allowed
            ${error ? "border-red-300 focus-visible:ring-red-500 focus-visible:border-red-500" : "border-dark-200"}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
