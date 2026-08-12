import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { dispatchMock, logServerErrorMock } = vi.hoisted(() => ({
  dispatchMock: vi.fn(),
  logServerErrorMock: vi.fn(),
}));

vi.mock("@/lib/services/notification-outbox.service", () => ({
  dispatchNotificationOutbox: dispatchMock,
}));
vi.mock("@/lib/server/logging", () => ({ logServerError: logServerErrorMock }));

import { GET } from "@/app/api/internal/notifications/dispatch/route";
import { authorizeNotificationWorker } from "@/lib/services/notification-worker-auth";

const STRONG_SECRET =
  "salonbook-worker-secret-that-is-longer-than-thirty-two-bytes";

function workerRequest(secret?: string) {
  return new Request("https://salonbook.test/api/internal/notifications/dispatch", {
    headers: secret ? { Authorization: `Bearer ${secret}` } : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.CRON_SECRET;
  dispatchMock.mockResolvedValue({
    status: "processed",
    claimed: 2,
    accepted: 1,
    retried: 1,
    dead: 0,
    lease_lost: 0,
  });
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("notification worker authorization", () => {
  it("fails closed for absent or weak configuration", () => {
    expect(authorizeNotificationWorker(null)).toBe("not_configured");
    process.env.CRON_SECRET = "too-short";
    expect(authorizeNotificationWorker("Bearer too-short")).toBe(
      "not_configured"
    );
  });

  it("accepts only an exact Bearer secret", () => {
    process.env.CRON_SECRET = STRONG_SECRET;

    expect(authorizeNotificationWorker(`Bearer ${STRONG_SECRET}`)).toBe(
      "authorized"
    );
    expect(authorizeNotificationWorker(`Bearer ${STRONG_SECRET}x`)).toBe(
      "unauthorized"
    );
    expect(authorizeNotificationWorker(STRONG_SECRET)).toBe("unauthorized");
  });
});

describe("notification worker route", () => {
  it("returns 503 and never dispatches when CRON_SECRET is unavailable", async () => {
    const response = await GET(workerRequest());

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("returns 401 and never dispatches for the wrong secret", async () => {
    process.env.CRON_SECRET = STRONG_SECRET;

    const response = await GET(workerRequest(`${STRONG_SECRET}-wrong`));

    expect(response.status).toBe(401);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("dispatches a bounded worker run for the correct secret", async () => {
    process.env.CRON_SECRET = STRONG_SECRET;

    const response = await GET(workerRequest(STRONG_SECRET));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(dispatchMock).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toMatchObject({
      status: "processed",
      claimed: 2,
    });
  });

  it("returns 503 when SMS is not configured without claiming success", async () => {
    process.env.CRON_SECRET = STRONG_SECRET;
    dispatchMock.mockResolvedValue({
      status: "transport_unavailable",
      claimed: 0,
      accepted: 0,
      retried: 0,
      dead: 0,
      lease_lost: 0,
    });

    const response = await GET(workerRequest(STRONG_SECRET));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "transport_unavailable",
      claimed: 0,
    });
  });

  it("contains worker failures and logs only the fixed safe scope", async () => {
    process.env.CRON_SECRET = STRONG_SECRET;
    const privateFailure = new Error("customer +254712345678");
    dispatchMock.mockRejectedValue(privateFailure);

    const response = await GET(workerRequest(STRONG_SECRET));

    expect(response.status).toBe(500);
    expect(logServerErrorMock).toHaveBeenCalledExactlyOnceWith(
      "notification_worker.dispatch",
      privateFailure
    );
    await expect(response.json()).resolves.toEqual({
      error: "Notification worker failed",
    });
  });
});
