import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({ query: queryMock }));

import { GET } from "@/app/api/discover/route";

afterEach(() => {
  queryMock.mockReset();
  vi.restoreAllMocks();
});

describe("discovery route", () => {
  it("returns database rows without logging", async () => {
    const rows = [{ id: "business-1", name: "Test Salon" }];
    queryMock.mockResolvedValue(rows);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET(new NextRequest("https://salonbook.test/api/discover"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(rows);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("logs only safe metadata and keeps the public error generic", async () => {
    const error = Object.assign(
      new Error("password=secret SELECT private_data user@example.test"),
      { code: "42P01", detail: "sensitive detail" }
    );
    queryMock.mockRejectedValue(error);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET(new NextRequest("https://salonbook.test/api/discover"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Failed to search businesses" });
    expect(consoleError).toHaveBeenCalledWith("[server:api.discover.database]", {
      name: "Error",
      code: "42P01",
    });
    const serialized = JSON.stringify(consoleError.mock.calls);
    expect(serialized).not.toContain("password=secret");
    expect(serialized).not.toContain("SELECT");
    expect(serialized).not.toContain("user@example.test");
    expect(serialized).not.toContain("sensitive detail");
  });
});
