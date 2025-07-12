import { vi, type Mock } from "vitest";

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