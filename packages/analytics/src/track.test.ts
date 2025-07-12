import { describe, it, expect, vi } from "vitest";
import * as Sentry from "@sentry/node";
import { track } from "./index.js";
import { captureConsoleInfo } from "./testUtils.js";

vi.mock("@sentry/node", () => ({
  addBreadcrumb: vi.fn(),
}));

describe("track()", () => {
  it("emits JSON with the exact expected format and adds a matching Sentry breadcrumb", () => {
    const breadcrumbSpy = Sentry.addBreadcrumb as unknown as import("vitest").Mock;
    const { output } = captureConsoleInfo(() => track("unit_test", { foo: "bar" }));

    const parsed = JSON.parse(output);

    // 1. Exact JSON keys
    expect(Object.keys(parsed).sort()).toEqual([
      "event",
      "properties",
      "timestamp",
      "type",
    ]);

    // 2. Field values
    expect(parsed.type).toBe("analytics");
    expect(parsed.event).toBe("unit_test");
    expect(parsed.properties).toEqual({ foo: "bar" });

    // 3. Timestamp must be valid ISO-8601 and equal after re-serialising
    const isoRegex = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)$/;
    expect(parsed.timestamp).toMatch(isoRegex);
    expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);

    // 4. Breadcrumb mirrors the event data
    expect(breadcrumbSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "analytics",
        message: "unit_test",
        data: { foo: "bar" },
      }),
    );
    // spy automatically tracked by vi.mock
  });

  it("outputs Vector-compatible JSON (single line, ends with no newline)", () => {
    const { output } = captureConsoleInfo(() => track("vector_test", { a: 1 }));
    // Vector expects one log entry per line (no internal newlines)
    expect(output.includes("\n")).toBe(false);
    const parsed = JSON.parse(output);
    expect(parsed).toMatchObject({ type: "analytics", event: "vector_test" });
  });
});