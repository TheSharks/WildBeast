---
title: Telemetry
description: OpenTelemetry and Sentry instrumentation in WildBeast.
sidebar:
  order: 1
---

WildBeast is instrumented end to end with OpenTelemetry (traces, metrics,
and logs), with optional Sentry error reporting layered on the same
pipeline. With no configuration, telemetry stays in-process and costs
nothing; setting a single variable exports everything.

## Enabling export

Point the standard OTLP endpoint variable at your collector and everything
flows:

```bash
# OTLP over HTTP (collector's 4318 port)
OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4318

# or OTLP over gRPC, detected from the scheme
OTEL_EXPORTER_OTLP_ENDPOINT=grpc://collector:4317
```

All three signals flow to the endpoint with the standard `/v1/<signal>`
paths appended for HTTP. The usual OpenTelemetry environment conventions are
honored:

| Variable | Description |
| --- | --- |
| `OTEL_EXPORTER_OTLP_<SIGNAL>_ENDPOINT` | Per-signal endpoint (`TRACES`, `METRICS`, `LOGS`), used verbatim. |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` or `http/protobuf`, overriding scheme detection. |
| `OTEL_EXPORTER_OTLP_HEADERS` | `key=value,key=value` headers (also per-signal). |
| `OTEL_EXPORTER_OTLP_TIMEOUT` | Export timeout in milliseconds. |
| `OTEL_EXPORTER_OTLP_COMPRESSION` | `gzip` or `none`. |
| `OTEL_SERVICE_NAME` | Overrides the reported service name. |

Every signal carries the resource identity used for grouping in dashboards:
`service.name` (`@thesharks/discord` for shards,
`@thesharks/discord-manager` for cluster managers), `service.instance.id`
(the shard id), `cluster.id`, and `deployment.environment.name`.

## Sentry

Setting `SENTRY_DSN` enables error capture and performance tracing through
the same OpenTelemetry pipeline. Command failures are reported with the
interaction's user, guild and channel attached on an isolated scope, and the
Sentry event id is shown to the user in the error reply for support
lookups. Every event is tagged with `cluster.id` and `shard.id`, so you can
filter issues to the cluster or shard that produced them.

Trace sampling is error-biased: command traces are always kept (that's
where user-facing failures live), recurring scheduled tasks are sampled at
5% in production, and everything else at 20% (100% outside production).

Beyond errors and traces, the SDK is wired for the rest of the Sentry
platform:

- Scheduled tasks report [cron check-ins](https://docs.sentry.io/product/crons/)
  under a monitor named after the task, so a run that never happens alerts
  just like a run that throws. Monitors are created automatically from the
  task's interval or cron pattern; BullMQ runs each repeated job on one
  worker, so a run checks in once fleet-wide.
- Error events include the local variables of every stack frame and any
  non-standard properties on the error object. discord.js API errors carry
  their status code, method and route this way, and `ZodError` issues are
  flattened into readable context.
- Continuous profiling attaches CPU profiles to sampled traces in shard
  workers. `SENTRY_PROFILE_SESSION_SAMPLE_RATE` (0 to 1, default 1) scales
  it; trace sampling already bounds the volume, since profiles are only
  collected while a sampled trace is active.
- A watchdog thread reports when any thread in the cluster process blocks
  its event loop for more than a second, with a stack trace of where it was
  stuck.
- Node runtime metrics (event loop, GC, memory) flow to the Sentry metrics
  product alongside the OTLP metrics.
- A few measurements go to Sentry metrics exclusively: guild joins and
  leaves (with the guild's size and shard attached) and the wait imposed by
  each REST rate limit. Sentry metrics are per-item and stamped with the
  active trace, with no client-side aggregation, so they carry the rare,
  inspectable events; the aggregated [OTLP metrics](/observability/metrics/)
  keep the high-volume series, and nothing is reported to both. Set
  `enableMetrics: false` in the telemetry config to turn them off.

Outgoing HTTP requests do not carry `sentry-trace` or `baggage` headers:
nothing downstream of the bot continues our traces, and user-controlled
fetches must not see trace metadata. Pass `tracePropagationTargets` to the
telemetry config if you add an internal service that should join traces.

:::note
For local development, set `SENTRY_SPOTLIGHT=true` to stream events to a
[Spotlight](https://spotlightjs.com/) sidecar instead of configuring a DSN.
:::

## What is instrumented

Commands and scheduled tasks run inside real spans (`discord.command.<name>`,
`discord.task.<name>`), so database and HTTP calls made during them nest as
child spans. Auto-instrumentation covers Postgres, Redis and outbound HTTP,
plus Node runtime metrics (event loop delay and utilization, GC pauses,
heap spaces); each can be disabled with
`OTEL_INSTRUMENTATION_<PG|UNDICI|IOREDIS|FS|RUNTIME_NODE>_ENABLED=false`.

Logs are written to the console and mirrored as OTLP log records and Sentry
logs, with the configured log level applied to all three. Metrics cover the
full lifecycle of the bot; see the
[metrics reference](/observability/metrics/).

## Troubleshooting

Set `OTEL_DIAGNOSTIC_LOG_LEVEL` (`error` … `debug`) to surface the
OpenTelemetry SDK's own diagnostics, for example when the collector isn't
receiving data. On shutdown, pending telemetry is flushed with a 10-second
deadline so a slow collector can't stall process termination.
