import { dispatchNotificationOutbox } from "@/lib/services/notification-outbox.service";
import { authorizeNotificationWorker } from "@/lib/services/notification-worker-auth";
import { logServerError } from "@/lib/server/logging";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

/** Vercel Cron invokes configured paths with GET and Authorization: Bearer. */
export async function GET(request: Request) {
  const authorization = authorizeNotificationWorker(
    request.headers.get("authorization")
  );
  if (authorization === "not_configured") {
    return Response.json(
      { error: "Notification worker is unavailable" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }
  if (authorization !== "authorized") {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const result = await dispatchNotificationOutbox();
    if (result.status === "transport_unavailable") {
      return Response.json(result, {
        status: 503,
        headers: NO_STORE_HEADERS,
      });
    }
    return Response.json(result, { headers: NO_STORE_HEADERS });
  } catch (error) {
    logServerError("notification_worker.dispatch", error);
    return Response.json(
      { error: "Notification worker failed" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
