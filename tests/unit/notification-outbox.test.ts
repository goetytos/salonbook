import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getReadinessMock,
  logServerErrorMock,
  queryMock,
  sendCancellationMock,
  sendConfirmationMock,
  sendOwnerAlertMock,
  transactionMock,
} = vi.hoisted(() => ({
  getReadinessMock: vi.fn(),
  logServerErrorMock: vi.fn(),
  queryMock: vi.fn(),
  sendCancellationMock: vi.fn(),
  sendConfirmationMock: vi.fn(),
  sendOwnerAlertMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  query: queryMock,
  transaction: transactionMock,
}));
vi.mock("@/lib/modules/sms", () => ({
  getSmsTransportReadiness: getReadinessMock,
}));
vi.mock("@/lib/services/notification.service", () => ({
  sendBookingCancellation: sendCancellationMock,
  sendBookingConfirmation: sendConfirmationMock,
  sendBookingOwnerAlert: sendOwnerAlertMock,
}));
vi.mock("@/lib/server/logging", () => ({ logServerError: logServerErrorMock }));

import {
  claimNotificationOutboxJobs,
  dispatchNotificationOutbox,
  enqueueBookingCancellationIntent,
  enqueueBookingNotificationIntents,
} from "@/lib/services/notification-outbox.service";

const BOOKING_ID = "33333333-3333-4333-8333-333333333333";
const BUSINESS_ID = "22222222-2222-4222-8222-222222222222";

function claimedJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    booking_id: BOOKING_ID,
    type: "booking_confirmation",
    attempt_count: 1,
    lease_token: "55555555-5555-4555-8555-555555555555",
    business_id: BUSINESS_ID,
    customer_name: "Amina",
    customer_phone: "+254712345678",
    owner_phone: "+254700000001",
    service_name: "Braids",
    booking_date: "2099-08-12",
    booking_time: "10:00",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getReadinessMock.mockReturnValue({ ready: true, status: "ready" });
  queryMock.mockImplementation(async (sql: string) =>
    sql.includes("SELECT booking.status AS booking_status")
      ? [{ booking_status: "Booked" }]
      : [{ id: "44444444-4444-4444-8444-444444444444" }]
  );
});

describe("notification outbox enqueue", () => {
  it("inserts exactly two PII-minimized intents through the supplied transaction", async () => {
    const client = { query: vi.fn().mockResolvedValue({ rowCount: 2 }) };

    await enqueueBookingNotificationIntents(client as never, BOOKING_ID);

    expect(client.query).toHaveBeenCalledOnce();
    const [sql, params] = client.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("booking_confirmation");
    expect(sql).toContain("booking_owner_alert");
    expect(sql).not.toMatch(/phone|customer_name|message/i);
    expect(params).toEqual([BOOKING_ID]);
  });

  it("throws unless both intents were durably returned", async () => {
    const client = { query: vi.fn().mockResolvedValue({ rowCount: 1 }) };

    await expect(
      enqueueBookingNotificationIntents(client as never, BOOKING_ID)
    ).rejects.toThrow(/not durably inserted/);
  });

  it("idempotently ensures one durable cancellation intent", async () => {
    const client = { query: vi.fn().mockResolvedValue({ rowCount: 1 }) };

    await enqueueBookingCancellationIntent(client as never, BOOKING_ID);

    const [sql, params] = client.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("booking_cancellation");
    expect(sql).toContain("ON CONFLICT (booking_id, type) DO NOTHING");
    expect(sql).not.toMatch(/phone|customer_name|message/i);
    expect(params).toEqual([BOOKING_ID]);
  });
});

describe("notification outbox claim and dispatch", () => {
  it("uses a bounded SKIP LOCKED lease and commits before provider work", async () => {
    let transactionCommitted = false;
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [claimedJob()] }),
    };
    transactionMock.mockImplementation(async (callback) => {
      const result = await callback(client);
      transactionCommitted = true;
      return result;
    });
    sendConfirmationMock.mockImplementation(async () => {
      expect(transactionCommitted).toBe(true);
      return {
        success: true,
        status: "accepted",
        provider: "africastalking",
        messageId: "ATXid_test-123",
      };
    });

    const result = await dispatchNotificationOutbox({ batchSize: 99 });

    const claimSql = client.query.mock.calls[3][0] as string;
    const claimParams = client.query.mock.calls[3][1] as unknown[];
    expect(claimSql).toContain("FOR UPDATE SKIP LOCKED");
    expect(claimSql).toContain("INTERVAL '2 minutes'");
    expect(claimParams[1]).toBe(10);
    expect(result).toEqual({
      status: "processed",
      claimed: 1,
      accepted: 1,
      retried: 0,
      dead: 0,
      lease_lost: 0,
    });
    expect(queryMock.mock.calls[1][0]).toContain("status = 'accepted'");
  });

  it("does not claim jobs when the SMS transport is disabled", async () => {
    getReadinessMock.mockReturnValue({
      ready: false,
      status: "disabled",
      errorCode: "notifications_disabled",
    });

    const result = await dispatchNotificationOutbox();

    expect(result.status).toBe("transport_unavailable");
    expect(result.claimed).toBe(0);
    expect(transactionMock).not.toHaveBeenCalled();
    expect(sendConfirmationMock).not.toHaveBeenCalled();
  });

  it("retries transient failures with a bounded database backoff", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [claimedJob({ attempt_count: 2 })] }),
    };
    transactionMock.mockImplementation((callback) => callback(client));
    sendConfirmationMock.mockResolvedValue({
      success: false,
      status: "failed",
      provider: "africastalking",
      errorCode: "network_error",
    });

    const result = await dispatchNotificationOutbox();

    expect(result.retried).toBe(1);
    expect(queryMock.mock.calls[1][0]).toContain("status = 'pending'");
    expect(queryMock.mock.calls[1][1]).toEqual([
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555",
      "network_error",
      300,
    ]);
  });

  it("dead-letters terminal and exhausted jobs", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [claimedJob({ attempt_count: 5, customer_phone: "invalid" })],
        }),
    };
    transactionMock.mockImplementation((callback) => callback(client));
    sendConfirmationMock.mockResolvedValue({
      success: false,
      status: "invalid_recipient",
      provider: "africastalking",
      errorCode: "invalid_recipient",
    });

    const result = await dispatchNotificationOutbox();

    expect(result.dead).toBe(1);
    expect(queryMock.mock.calls[1][0]).toContain("status = 'dead'");
  });

  it("suppresses a leased creation alert when its booking is no longer Booked", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [claimedJob()] }),
    };
    transactionMock.mockImplementation((callback) => callback(client));
    queryMock.mockImplementation(async (sql: string) =>
      sql.includes("SELECT booking.status AS booking_status")
        ? [{ booking_status: "Cancelled" }]
        : [{ id: "44444444-4444-4444-8444-444444444444" }]
    );

    const result = await dispatchNotificationOutbox();

    expect(result.dead).toBe(1);
    expect(sendConfirmationMock).not.toHaveBeenCalled();
    expect(queryMock.mock.calls[1][1]).toEqual([
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555",
      "booking_status_mismatch",
    ]);
  });

  it("dispatches a cancellation intent only for a Cancelled booking", async () => {
    const cancellation = claimedJob({ type: "booking_cancellation" });
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [cancellation] }),
    };
    transactionMock.mockImplementation((callback) => callback(client));
    queryMock.mockImplementation(async (sql: string) =>
      sql.includes("SELECT booking.status AS booking_status")
        ? [{ booking_status: "Cancelled" }]
        : [{ id: "44444444-4444-4444-8444-444444444444" }]
    );
    sendCancellationMock.mockResolvedValue({
      success: true,
      status: "accepted",
      provider: "africastalking",
      messageId: "ATXid_cancel-123",
    });

    const result = await dispatchNotificationOutbox();

    expect(result.accepted).toBe(1);
    expect(sendCancellationMock).toHaveBeenCalledOnce();
    expect(sendConfirmationMock).not.toHaveBeenCalled();
  });

  it("validates a booking-scoped claim before opening a transaction", async () => {
    await expect(
      claimNotificationOutboxJobs({ bookingId: "not-a-uuid" })
    ).rejects.toThrow(/Invalid outbox booking identifier/);
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
