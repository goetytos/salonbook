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
  const available = slots.filter((s) => s.available);

  if (available.length === 0) {
    return (
      <p className="text-dark-500 text-sm">
        No available times on this date. Try another day.
      </p>
    );
  }

  const grouped = {
    morning: available.filter((s) => getTimeOfDay(s.time) === "morning"),
    afternoon: available.filter((s) => getTimeOfDay(s.time) === "afternoon"),
    evening: available.filter((s) => getTimeOfDay(s.time) === "evening"),
  };

  const sections = [
    { key: "morning", label: "Morning", icon: "sun" },
    { key: "afternoon", label: "Afternoon", icon: "sun" },
    { key: "evening", label: "Evening", icon: "moon" },
  ] as const;

  return (
    <div className="space-y-4">
      {sections.map(
        ({ key, label }) =>
          grouped[key].length > 0 && (
            <div key={key}>
              <p className="text-xs font-medium text-dark-500 uppercase tracking-wider mb-2">
                {label}
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {grouped[key].map((slot) => (
                  <button
                    key={slot.time}
                    onClick={() => onSelect(slot.time)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium border transition ${
                      selectedTime === slot.time
                        ? "bg-primary-600 text-white border-primary-600"
                        : "bg-white text-dark-700 border-dark-200 hover:border-primary-300"
                    }`}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            </div>
          )
      )}
    </div>
  );
}
