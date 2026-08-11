"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import { format, addDays, startOfWeek } from "date-fns";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import DashboardState from "@/components/dashboard/DashboardState";
import type { Booking } from "@/types";

const hours = Array.from({ length: 12 }, (_, index) => index + 7);

export default function CalendarView() {
  const { business } = useAuth();
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchCalendar = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    setError("");
    try {
      const start = format(weekStart, "yyyy-MM-dd");
      const end = format(addDays(weekStart, 6), "yyyy-MM-dd");
      const data = await api.get<Booking[]>(`/businesses/${business.id}/calendar?start=${start}&end=${end}`);
      setBookings(data);
    } catch (requestError) {
      setBookings([]);
      setError(requestError instanceof Error ? requestError.message : "Calendar data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [business, weekStart]);

  useEffect(() => {
    void fetchCalendar();
  }, [fetchCalendar]);

  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const sortedBookings = [...bookings].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const getBookingsForDayHour = (day: Date, hour: number) => bookings.filter((booking) => {
    const bookingDate = booking.date.split("T")[0];
    const bookingHour = Number.parseInt(booking.time?.slice(0, 2) || "0", 10);
    return bookingDate === format(day, "yyyy-MM-dd") && bookingHour === hour;
  });

  const badgeVariant = (status: string) => {
    if (status === "Booked") return "success" as const;
    if (status === "Cancelled" || status === "No-Show") return "danger" as const;
    return "default" as const;
  };

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 rounded-xl border border-dark-200 bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
        <Button size="sm" variant="secondary" onClick={() => setWeekStart((current) => addDays(current, -7))} aria-label="Show previous week">
          ← Previous
        </Button>
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-700">Week of</p>
          <h2 className="mt-1 text-sm font-semibold text-dark-900">{format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}</h2>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Today</Button>
          <Button size="sm" variant="secondary" onClick={() => setWeekStart((current) => addDays(current, 7))} aria-label="Show next week">
            Next →
          </Button>
        </div>
      </div>

      {loading ? (
        <DashboardState type="loading" title="Loading calendar" />
      ) : error ? (
        <DashboardState type="error" title="Calendar unavailable" description={error} onRetry={fetchCalendar} />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {sortedBookings.length === 0 ? (
              <DashboardState title="No appointments this week" description="Bookings for this week will appear here in time order." />
            ) : sortedBookings.map((booking) => (
              <article key={booking.id} className="rounded-2xl border border-dark-200 bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary-700">
                      {new Date(booking.date + "T00:00:00").toLocaleDateString("en-KE", { weekday: "short", month: "short", day: "numeric" })} · {booking.time?.slice(0, 5)}
                    </p>
                    <h3 className="mt-2 font-semibold text-dark-900">{booking.customer_name}</h3>
                    <p className="mt-1 text-sm text-dark-500">{booking.service_name}{booking.staff_name && ` · ${booking.staff_name}`}</p>
                  </div>
                  <Badge variant={badgeVariant(booking.status)}>{booking.status}</Badge>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-2xl border border-dark-200 bg-surface md:block">
            <table className="w-full text-xs">
              <caption className="sr-only">Appointments from {format(weekStart, "MMMM d")} to {format(addDays(weekStart, 6), "MMMM d, yyyy")}</caption>
              <thead>
                <tr className="bg-dark-50">
                  <th scope="col" className="w-16 border-r border-dark-200 px-2 py-3 text-left font-bold text-dark-500">Time</th>
                  {days.map((day) => (
                    <th scope="col" key={day.toISOString()} className="min-w-32 border-r border-dark-200 px-2 py-3 text-center font-semibold text-dark-700 last:border-r-0">
                      <span className="block">{format(day, "EEE")}</span>
                      <span className="mt-0.5 block font-normal text-dark-500">{format(day, "MMM d")}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hours.map((hour) => (
                  <tr key={hour} className="border-t border-dark-200">
                    <th scope="row" className="border-r border-dark-200 px-2 py-3 text-left align-top font-mono font-semibold tabular-nums text-dark-500">{String(hour).padStart(2, "0")}:00</th>
                    {days.map((day) => (
                      <td key={day.toISOString()} className="border-r border-dark-200 p-1 align-top last:border-r-0">
                        {getBookingsForDayHour(day, hour).map((booking) => (
                          <div key={booking.id} className="mb-1 rounded-lg border border-primary-200 bg-primary-50 p-2 last:mb-0">
                            <p className="truncate font-semibold text-primary-900">{booking.customer_name}</p>
                            <p className="mt-0.5 truncate text-primary-700">{booking.service_name}</p>
                            <p className="mt-0.5 truncate text-primary-600">{booking.time?.slice(0, 5)}{booking.staff_name && ` · ${booking.staff_name}`}</p>
                          </div>
                        ))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
