import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { validatePromotionMock } = vi.hoisted(() => ({
  validatePromotionMock: vi.fn(),
}));

vi.mock("@/lib/services/promotion.service", () => ({
  validatePromotion: validatePromotionMock,
}));

import { POST } from "@/app/api/promotions/validate/route";

const BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
const SERVICE_ID = "22222222-2222-4222-8222-222222222222";

function request(body: Record<string, unknown>): NextRequest {
  return new NextRequest("https://salonbook.test/api/promotions/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  validatePromotionMock.mockReset();
});

describe("promotion validation route", () => {
  it.each([undefined, "2099-02-30", "11/08/2099"])(
    "rejects a missing or non-canonical booking date (%s)",
    async (bookingDate) => {
      const response = await POST(
        request({
          business_id: BUSINESS_ID,
          code: "DATE10",
          booking_date: bookingDate,
          service_id: SERVICE_ID,
        })
      );

      expect(response.status).toBe(400);
      expect(validatePromotionMock).not.toHaveBeenCalled();
    }
  );

  it("passes the canonical appointment date to promotion validation", async () => {
    validatePromotionMock.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      code: "DATE10",
      discount_type: "percentage",
      discount_value: 10,
    });

    const response = await POST(
      request({
        business_id: BUSINESS_ID,
        code: " date10 ",
        booking_date: "2099-08-11",
        service_id: SERVICE_ID,
      })
    );

    expect(response.status).toBe(200);
    expect(validatePromotionMock).toHaveBeenCalledWith(
      BUSINESS_ID,
      "date10",
      "2099-08-11",
      SERVICE_ID
    );
  });
});
