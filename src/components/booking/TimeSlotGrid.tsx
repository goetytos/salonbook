"use client";

import type { TimeSlot } from "@/types";

interface TimeSlotGridProps {
  slots: TimeSlot[];
  selectedTime: string;
  onSelect: (time: string) => void;
}

function getTimeOfDay(time: string): "morning" | "afternoon" | "evening" {
  const hour = parseInt(time.split(":")[0], 10);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export default function TimeSlotGrid({ slots, selectedTime, onSelect }: TimeSlotGridProps) {
  const available = slots.filter((slot) => slot.available);
  if (available.length === 0) {
    return (
      <div className="rounded-2xl border border-dark-200 bg-dark-50 p-5 text-sm leading-6 text-dark-500" role="status">
        <p className="font-semibold text-dark-800">No open times on this date</p>
        <p className="mt-1">Choose another day to continue.</p>
      </div>
    );
  }

  const grouped = {
    morning: available.filter((slot) => getTimeOfDay(slot.time) === "morning"),
    afternoon: available.filter((slot) => getTimeOfDay(slot.time) === "afternoon"),
    evening: available.filter((slot) => getTimeOfDay(slot.time) === "evening"),
  };

  const sections = [
    { key: "morning", label: "Morning" },
    { key: "afternoon", label: "Afternoon" },
    { key: "evening", label: "Evening" },
  ] as const;

  return (
    <div className="space-y-5" aria-label="Available appointment times">
      {sections.map(({ key, label }) => grouped[key].length > 0 && (
        <fieldset key={key}>
          <legend className="mb-2 text-[0.66rem] font-bold uppercase tracking-[0.14em] text-dark-500">{label}</legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {grouped[key].map((slot) => (
              <button
                key={slot.time}
                type="button"
                aria-pressed={selectedTime === slot.time}
                onClick={() => onSelect(slot.time)}
                className={`min-h-11 rounded-lg border px-2 font-mono text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${selectedTime === slot.time ? "border-primary-900 bg-primary-900 text-white" : "border-dark-200 bg-surface text-dark-700 hover:border-primary-400 hover:bg-primary-50"}`}
              >
                {slot.time}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
