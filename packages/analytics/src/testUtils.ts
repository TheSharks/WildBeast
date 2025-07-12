import { vi, type Mock, expect } from "vitest";

/** Capture console.info output during a function run. */
export function captureConsoleInfo<T>(fn: () => T): { output: string; result: T } {
  const spy = vi.spyOn(console, "info").mockImplementation(() => {});
  const result = fn();
  const output = spy.mock.calls[0]?.[0] as string;
  spy.mockRestore();
  return { output, result };
}

/**
 * Replace Sentry.addBreadcrumb with a spy and return it so tests can make
 * assertions. Automatically restores the original implementation when the
 * current test finishes.
 */
export function mockSentry() {
  // Lazy import to ensure the real module is available
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const Sentry: typeof import("@sentry/node") = require("@sentry/node");
  const original = Sentry.addBreadcrumb;
  const spy: Mock = vi.fn();
  // @ts-ignore: override for test purposes
  Sentry.addBreadcrumb = spy;

  const restore = () => {
    // @ts-ignore: restore original
    Sentry.addBreadcrumb = original;
  };
  return { spy, restore };
}

/** Capture *all* console.info calls executed within a function. */
export function captureConsoleInfos<T>(fn: () => T): { outputs: string[]; result: T } {
  const spy = vi.spyOn(console, "info").mockImplementation(() => {});
  const result = fn();
  const outputs = spy.mock.calls.map((c) => c[0] as string);
  spy.mockRestore();
  return { outputs, result };
}

/** Simple ISO-8601 timestamp validator (YYYY-MM-DDTHH:mm:ss.sssZ). */
export function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    new Date(value).toISOString() === value
  );
}

/** Assert breadcrumb spy was called once with the expected data. */
export function expectBreadcrumb(
  spy: Mock,
  event: string,
  properties: Record<string, unknown>
) {
  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy).toHaveBeenCalledWith(
    expect.objectContaining({
      category: "analytics",
      level: "info",
      message: event,
      data: properties,
    }),
  );
}