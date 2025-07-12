import { describe, it, expect, vi } from "vitest";
import * as Sentry from "@sentry/node";
import { track } from "./index.js";
import { captureConsoleInfo, captureConsoleInfos, expectBreadcrumb } from "./testUtils.js";

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

  it.each([
    { event: "", props: {} },
    { event: "a".repeat(512), props: { long: "x".repeat(1024) } },
    { event: "special_chars", props: { text: "newline\n tab\t quote\"" } },
    { event: "unicode", props: { emoji: "🐳", language: "日本語" } },
    { event: "null_props", props: null as unknown as Record<string, unknown> },
  ])("edge case %#", ({ event, props }) => {
    const breadcrumbSpy = Sentry.addBreadcrumb as unknown as import("vitest").Mock;
    breadcrumbSpy.mockClear();
    const { outputs } = captureConsoleInfos(() => track(event as string, props));

    // verify single log line per call
    expect(outputs.length).toBeGreaterThan(0);
    outputs.forEach((line) => {
      expect(line.includes("\n")).toBe(false);
      const json = JSON.parse(line);
      expect(json.type).toBe("analytics");
      expect(json.event).toBe(event);
      expect(json).toHaveProperty("timestamp");
      expect(json).toHaveProperty("properties");
      // timestamp strict ISO
      expect(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/.test(json.timestamp)).toBe(true);
    });

    // breadcrumb should reflect last call
    if (props !== null) {
      expectBreadcrumb(breadcrumbSpy, event, props);
    }
  });
});