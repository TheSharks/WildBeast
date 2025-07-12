import { describe, it, expect, vi } from "vitest";
import * as Sentry from "@sentry/node";
import { track } from "./index.js";
import { captureConsoleInfo } from "./testUtils.js";

vi.mock("@sentry/node", () => ({
  addBreadcrumb: vi.fn(),
}));

describe("track()", () => {
  it("emits single-line JSON and adds Sentry breadcrumb", () => {
    const breadcrumbSpy = Sentry.addBreadcrumb as unknown as import("vitest").Mock;
    const { output } = captureConsoleInfo(() => track("unit_test", { foo: "bar" }));

    const parsed = JSON.parse(output);
    expect(parsed).toEqual(
      expect.objectContaining({
        type: "analytics",
        event: "unit_test",
        properties: { foo: "bar" },
      }),
    );
    // timestamp should be valid ISO string
    expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);

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
    expect(output.includes("\n")).toBe(false);
    const parsed = JSON.parse(output);
    expect(parsed).toMatchObject({ type: "analytics", event: "vector_test" });
  });
});