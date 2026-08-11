"use client";

import { useId, useRef } from "react";
import type { KeyboardEvent } from "react";

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
}

export default function Tabs({ tabs, activeTab, onChange, ariaLabel = "Sections" }: TabsProps) {
  const idPrefix = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);

  const activateTab = (index: number) => {
    if (tabs.length === 0) return;
    const normalizedIndex = (index + tabs.length) % tabs.length;
    tabRefs.current[normalizedIndex]?.focus();
    onChange(tabs[normalizedIndex].id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        activateTab(index - 1);
        break;
      case "ArrowRight":
        event.preventDefault();
        activateTab(index + 1);
        break;
      case "Home":
        event.preventDefault();
        activateTab(0);
        break;
      case "End":
        event.preventDefault();
        activateTab(tabs.length - 1);
        break;
    }
  };

  return (
    <div className="border-b border-dark-200">
      <div
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        className="flex gap-0 -mb-px overflow-x-auto"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            id={`${idPrefix}-${tab.id}-tab`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id || (activeIndex === -1 && index === 0) ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`min-h-11 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 ${
              activeTab === tab.id
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-dark-500 hover:text-dark-700 hover:border-dark-300"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id
                    ? "bg-primary-100 text-primary-700"
                    : "bg-dark-100 text-dark-500"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
