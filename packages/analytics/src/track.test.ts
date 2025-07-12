import { describe, it, expect, vi, type Mock } from "vitest";

vi.mock("@sentry/node", () => {
  return {
    addBreadcrumb: vi.fn(),
  };
});

import * as Sentry from "@sentry/node";
import { track } from "./index.js";

describe("track()", () => {
  it("emits single-line JSON and adds Sentry breadcrumb", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const breadcrumbSpy = Sentry.addBreadcrumb as unknown as Mock;

    track("unit_test", { foo: "bar" });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const arg = infoSpy.mock.calls[0][0] as string;

    const parsed = JSON.parse(arg);
    expect(parsed).toMatchObject({
      type: "analytics",
      event: "unit_test",
      properties: { foo: "bar" },
    });
    expect(typeof parsed.timestamp).toBe("string");

    expect(breadcrumbSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "analytics",
        message: "unit_test",
        data: { foo: "bar" },
      }),
    );
  });

  it("outputs Vector-compatible JSON (single line, ends with no newline)", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    track("vector_test", { a: 1 });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const arg = infoSpy.mock.calls[0][0] as string;

    // must be single-line JSON (no embedded newlines)
    expect(arg.includes("\n")).toBe(false);

    const parsed = JSON.parse(arg);
    expect(parsed).toMatchObject({ type: "analytics", event: "vector_test" });
  });
});