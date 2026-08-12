import { queryOne } from "@/lib/db";
import { logServerError } from "@/lib/server/logging";

export const dynamic = "force-dynamic";

/** Generic liveness/dependency signal for an external uptime monitor. */
export async function GET() {
  try {
    const check = await queryOne<{ ok: number }>("SELECT 1::int AS ok");
    if (check?.ok !== 1) throw new Error("Health check returned an invalid value");

    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logServerError("api.health.database", error);
    return Response.json(
      { status: "unavailable" },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": "30",
        },
      }
    );
  }
}
