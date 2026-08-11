import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { errorResponse, sanitize } from "@/lib/validation";

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

// GET /api/discover?q=&category= — public discovery search
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const rawQuery = url.searchParams.get("q") || "";
    const rawCategory = url.searchParams.get("category") || "";
    if (rawQuery.length > 100 || rawCategory.length > 100) {
      return errorResponse("Search filters are too long");
    }
    const q = sanitize(rawQuery);
    const category = sanitize(rawCategory);

    let sql = `
      SELECT b.id, b.name, b.slug, b.location, b.category,
             b.avatar_url, b.description,
             COALESCE(AVG(r.rating), 0)::numeric as avg_rating,
             COUNT(r.id)::int as review_count
      FROM businesses b
      LEFT JOIN reviews r ON b.id = r.business_id
      WHERE b.status = 'active'
    `;
    const params: unknown[] = [];

    if (q) {
      params.push(`%${escapeLikePattern(q)}%`);
      sql += ` AND (b.name ILIKE $${params.length} ESCAPE '\\' OR b.location ILIKE $${params.length} ESCAPE '\\')`;
    }

    if (category) {
      params.push(category);
      sql += ` AND b.category = $${params.length}`;
    }

    sql += ` GROUP BY b.id ORDER BY avg_rating DESC, b.name ASC LIMIT 50`;

    const businesses = await query(sql, params);
    return Response.json(businesses);
  } catch {
    return errorResponse("Failed to search businesses", 500);
  }
}
