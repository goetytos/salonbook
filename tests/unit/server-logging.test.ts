import { afterEach, describe, expect, it, vi } from "vitest";
import { logServerError, safeErrorMetadata } from "@/lib/server/logging";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("safe server logging", () => {
  it("keeps bounded operational identifiers", () => {
    const error = Object.assign(new Error("password=secret"), { code: "ECONNREFUSED" });

    expect(safeErrorMetadata(error)).toEqual({ name: "Error", code: "ECONNREFUSED" });
  });

  it("drops malformed fields and never includes an error message", () => {
    const error = Object.assign(new Error("SELECT * FROM private_data"), {
      name: "DatabaseError\npassword=secret",
      code: "42P01 user@example.test",
      detail: "sensitive detail",
    });

    expect(safeErrorMetadata(error)).toEqual({ name: "Error" });
    expect(safeErrorMetadata("password=secret")).toEqual({ name: "UnknownError" });
  });

  it("logs only the fixed scope and redacted metadata", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = Object.assign(new Error("password=secret SELECT user@example.test"), {
      code: "42P01",
      detail: "sensitive detail",
    });

    logServerError("api.discover.database", error);

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
