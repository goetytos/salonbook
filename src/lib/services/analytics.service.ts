import { query, queryOne } from "@/lib/db";
import type { AnalyticsData } from "@/types";

/** Get analytics data for a business */
export async function getAnalytics(
  businessId: string,
  period: "7d" | "30d" | "90d" = "30d"
): Promise<AnalyticsData> {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const start = startDate.toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  // Revenue over time
  const revenue = await query<{ date: string; amount: number }>(
    `SELECT b.date::text as date, COALESCE(SUM(s.price), 0)::numeric as amount
     FROM bookings b
     JOIN services s ON b.service_id = s.id
     WHERE b.business_id = $1 AND b.date >= $2 AND b.date <= $3
       AND b.status = 'Completed'
     GROUP BY b.date
     ORDER BY b.date ASC`,
    [businessId, start, today]
  );

  // Bookings over time
  const bookings = await query<{ date: string; count: number }>(
    `SELECT date::text as date, COUNT(*)::int as count
     FROM bookings
     WHERE business_id = $1 AND date >= $2 AND date <= $3
       AND status NOT IN ('Cancelled', 'No-Show')
     GROUP BY date
     ORDER BY date ASC`,
    [businessId, start, today]
  );

  // Popular services
  const popularServices = await query<{ name: string; count: number }>(
    `SELECT s.name, COUNT(*)::int as count
     FROM bookings b
     JOIN services s ON b.service_id = s.id
     WHERE b.business_id = $1 AND b.date >= $2 AND b.date <= $3
       AND b.status NOT IN ('Cancelled', 'No-Show')
     GROUP BY s.name
     ORDER BY count DESC
     LIMIT 5`,
    [businessId, start, today]
  );

  // Peak hours
  const peakHours = await query<{ hour: number; count: number }>(
    `SELECT EXTRACT(HOUR FROM time)::int as hour, COUNT(*)::int as count
     FROM bookings
     WHERE business_id = $1 AND date >= $2 AND date <= $3
       AND status NOT IN ('Cancelled', 'No-Show')
     GROUP BY hour
     ORDER BY hour ASC`,
    [businessId, start, today]
  );

  // Totals
  const totals = await queryOne<{
    total_revenue: number;
    total_bookings: number;
    new_customers: number;
  }>(
    `SELECT
       (SELECT COALESCE(SUM(s.price), 0) FROM bookings b JOIN services s ON b.service_id = s.id
        WHERE b.business_id = $1 AND b.date >= $2 AND b.status = 'Completed')::numeric as total_revenue,
       (SELECT COUNT(*) FROM bookings WHERE business_id = $1 AND date >= $2
        AND status NOT IN ('Cancelled', 'No-Show'))::int as total_bookings,
       (SELECT COUNT(DISTINCT customer_id) FROM bookings WHERE business_id = $1
        AND date >= $2)::int as new_customers`,
    [businessId, start]
  );

  // Average rating
  const ratingResult = await queryOne<{ avg_rating: number }>(
    "SELECT COALESCE(AVG(rating), 0)::numeric as avg_rating FROM reviews WHERE business_id = $1",
    [businessId]
  );

  return {
    period,
    revenue: revenue.map((r) => ({ date: r.date, amount: Number(r.amount) })),
    bookings: bookings.map((b) => ({ date: b.date, count: b.count })),
    popular_services: popularServices,
    peak_hours: peakHours,
    total_revenue: Number(totals?.total_revenue || 0),
    total_bookings: totals?.total_bookings || 0,
    avg_rating: Number(ratingResult?.avg_rating || 0),
    new_customers: totals?.new_customers || 0,
  };
}
