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
lookups.

Trace sampling is error-biased: command traces are always kept (that's
where user-facing failures live), recurring scheduled tasks are sampled at
5% in production, and everything else at 20% (100% outside production).

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
