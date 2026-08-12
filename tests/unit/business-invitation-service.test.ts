import { afterEach, describe, expect, it, vi } from "vitest";

const { transactionMock, queryMock } = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  queryMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  transaction: transactionMock,
}));

import {
  BusinessInvitationError,
  createBusinessInvitation,
  digestBusinessInvitationToken,
} from "@/lib/services/business-invitation.service";

afterEach(() => {
  vi.clearAllMocks();
});

describe("business invitation service", () => {
  it("rejects addresses that cannot fit the business account column", async () => {
    await expect(
      createBusinessInvitation(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        `${"a".repeat(244)}@example.test`
      )
    ).rejects.toMatchObject({ status: 422 });
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("generates a 256-bit token but sends only its SHA-256 digest to PostgreSQL", async () => {
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes("INSERT INTO public.business_invitations")) {
        return {
          rows: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              email: "owner@studio.co.ke",
              expires_at: "2026-08-15T12:00:00.000Z",
              created_at: "2026-08-12T12:00:00.000Z",
            },
          ],
        };
      }
      return { rows: [] };
    });
    transactionMock.mockImplementation(
      async (callback: (client: { query: typeof queryMock }) => Promise<unknown>) =>
        callback({ query: queryMock })
    );

    const result = await createBusinessInvitation(
      "11111111-1111-4111-8111-111111111111",
      " Owner@Studio.co.ke ",
      72
    );

    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.invitation.email).toBe("owner@studio.co.ke");
    const databaseCalls = JSON.stringify(queryMock.mock.calls);
    expect(databaseCalls).not.toContain(result.token);
    expect(databaseCalls).toContain(
      digestBusinessInvitationToken(result.token)
    );
  });

  it.each([0, 1.5, 169])(
    "rejects an unsafe %s-hour expiry before opening a transaction",
    async (hours) => {
      await expect(
        createBusinessInvitation("admin-id", "owner@studio.co.ke", hours)
      ).rejects.toBeInstanceOf(BusinessInvitationError);
      expect(transactionMock).not.toHaveBeenCalled();
    }
  );
});
