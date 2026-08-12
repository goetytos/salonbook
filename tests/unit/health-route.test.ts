import { afterEach, describe, expect, it, vi } from "vitest";

const { queryOneMock } = vi.hoisted(() => ({ queryOneMock: vi.fn() }));

vi.mock("@/lib/db", () => ({ queryOne: queryOneMock }));

import { GET } from "@/app/api/health/route";

afterEach(() => {
  queryOneMock.mockReset();
  vi.restoreAllMocks();
});

describe("health route", () => {
  it("returns a generic healthy response when PostgreSQL responds", async () => {
    queryOneMock.mockResolvedValue({ ok: 1 });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok" });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("does not expose database failures", async () => {
    queryOneMock.mockRejectedValue(
      Object.assign(new Error("password=secret host=db.internal"), {
        code: "ECONNREFUSED",
      })
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(await response.json()).toEqual({ status: "unavailable" });
    expect(consoleError).toHaveBeenCalledWith("[server:api.health.database]", {
      name: "Error",
      code: "ECONNREFUSED",
    });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("secret");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("db.internal");
  });
});
