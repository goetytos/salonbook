"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import { format, addDays, startOfWeek } from "date-fns";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import type { Booking } from "@/types";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 07:00 to 18:00

export default function CalendarView() {
  const { business } = useAuth();
  const [weekStart, setWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCalendar = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    try {
      const start = format(weekStart, "yyyy-MM-dd");
      const end = format(addDays(weekStart, 6), "yyyy-MM-dd");
      const data = await api.get<Booking[]>(
        `/businesses/${business.id}/calendar?start=${start}&end=${end}`
      );
      setBookings(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [business, weekStart]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getBookingsForDayHour = (day: Date, hour: number) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return bookings.filter((b) => {
      const bookingDate = b.date.split("T")[0];
      const bookingHour = parseInt(b.time?.slice(0, 2) || "0", 10);
      return bookingDate === dayStr && bookingHour === hour;
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setWeekStart((prev) => addDays(prev, -7))}
        >
          Previous
        </Button>
        <h3 className="text-sm font-semibold text-dark-900">
          {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
        </h3>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setWeekStart((prev) => addDays(prev, 7))}
        >
          Next
        </Button>
      </div>

      {loading ? (
        <p className="text-dark-400 text-sm">Loading calendar...</p>
      ) : (
        <div className="overflow-x-auto border border-dark-200 rounded-lg">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-dark-50">
                <th className="w-16 px-2 py-2 text-left text-dark-500 font-medium border-r border-dark-200">
                  Time
                </th>
                {days.map((day) => (
                  <th
                    key={day.toString()}
                    className="px-2 py-2 text-center text-dark-700 font-medium border-r border-dark-200 last:border-r-0 min-w-[120px]"
                  >
                    <div>{format(day, "EEE")}</div>
                    <div className="text-dark-500 font-normal">{format(day, "MMM d")}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOURS.map((hour) => (
                <tr key={hour} className="border-t border-dark-100">
                  <td className="px-2 py-3 text-dark-500 font-medium border-r border-dark-200 align-top">
                    {String(hour).padStart(2, "0")}:00
                  </td>
                  {days.map((day) => {
                    const dayBookings = getBookingsForDayHour(day, hour);
                    return (
                      <td
                        key={day.toString()}
                        className="px-1 py-1 border-r border-dark-200 last:border-r-0 align-top"
                      >
                        {dayBookings.map((b) => (
                          <div
                            key={b.id}
                            className="bg-primary-50 border border-primary-200 rounded p-1 mb-1"
                          >
                            <p className="font-medium text-primary-800 truncate">
                              {b.customer_name}
                            </p>
                            <p className="text-primary-600 truncate">
                              {b.service_name}
                            </p>
                            <p className="text-primary-500">
                              {b.time?.slice(0, 5)}
                              {b.staff_name && ` - ${b.staff_name}`}
                            </p>
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
