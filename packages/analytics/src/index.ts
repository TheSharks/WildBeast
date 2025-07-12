import * as Sentry from "@sentry/node";

export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
}

/**
 * Emit an analytics event.
 *
 * Events are logged as structured JSON to `stdout`, making them easy to read
 * with Vector, Loki, Elastic, or any other log pipeline.  Each event is also
 * added to Sentry as a breadcrumb so that contextual information shows up
 * alongside errors.
 *
 * @param event - A short, machine-readable event name (e.g. `command_invocation`).
 * @param properties - Additional key/value pairs that further describe the event.
 */
export function track(
  event: string,
  properties: Record<string, unknown> = {}
): void {
  const payload = {
    type: "analytics", // easy routing identifier for Vector
    event,
    properties,
    timestamp: new Date().toISOString(),
  } satisfies Required<AnalyticsEvent> & { type: string };

  // Feed into Sentry as a breadcrumb for richer error context.
  Sentry.addBreadcrumb({
    category: "analytics",
    message: event,
    data: properties,
    level: "info",
  });

  // Emit JSON so that Vector can ship it wherever we want.
  // We purposely use console.info instead of console.log so that the log level
  // stays consistent with Sapphire's logger `INFO` level and isn't filtered out.
  // Stringify once to keep a single-line log entry for easier parsing.
  // eslint-disable-next-line no-console
  console.info(JSON.stringify(payload));
}