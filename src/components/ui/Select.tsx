"use client";

import { SelectHTMLAttributes, forwardRef, useId } from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      options,
      placeholder,
      className = "",
      id,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id || generatedId;
    const errorId = `${selectId}-error`;
    const describedBy = [ariaDescribedBy, error ? errorId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-dark-700">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          aria-describedby={describedBy}
          aria-invalid={error ? true : ariaInvalid}
          className={`
            min-h-11 w-full px-3 py-2 border rounded-lg text-dark-900 bg-white
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-primary-500
            disabled:bg-dark-50 disabled:cursor-not-allowed
            ${error ? "border-red-300 focus-visible:ring-red-500 focus-visible:border-red-500" : "border-dark-200"}
            ${className}
          `}
          {...props}
        >
          {placeholder && (
            <option value="">{placeholder}</option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p id={errorId} className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";
export default Select;
