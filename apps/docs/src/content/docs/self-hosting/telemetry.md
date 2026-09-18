---
title: Telemetry
description: OpenTelemetry and Sentry instrumentation in WildBeast.
sidebar:
  order: 8
---

WildBeast records traces, metrics, and logs through OpenTelemetry. Configure
an OTLP collector endpoint to export them, and add a Sentry DSN if you want
Sentry error reporting. Without an endpoint, OTLP export is disabled.

## Enabling export

Set `OTEL_EXPORTER_OTLP_ENDPOINT` to your collector address:

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
interaction's user, guild, and channel ids attached on an isolated scope, and
the Sentry event id is shown to the user in the error reply for support
lookups. Usernames, guild names, and channel names are left out unless you
set `SENTRY_INCLUDE_PII=true`. Every event is tagged with `cluster.id` and
`shard.id`, so you can filter issues to the cluster or shard that produced
them.

Trace sampling is error-biased: command traces are always kept (that's
where user-facing failures live), recurring scheduled tasks are sampled at
5% in production, and everything else at 20% (100% outside production).

Every event carries a release identifier so Sentry can tell you which
version introduced a regression. The official Docker images bake it in as
`SENTRY_RELEASE` (matching the image tag, `@thesharks/discord@9.0.0` for
example). If you run from source, set `SENTRY_RELEASE` yourself, or events
fall back to the package version when launched through pnpm scripts, then
the `GIT_COMMIT` environment variable, then `dev`.

The Sentry integration also reports the following data:

- Scheduled tasks report [cron check-ins](https://docs.sentry.io/product/crons/)
  under a monitor named after the task, so a run that never happens alerts
  just like a run that throws. Monitors are created automatically from the
  task's interval or cron pattern. Shard-bound jobs check in from their
  owner; per-worker jobs, such as metrics collection, check in on each worker.
- Error events include the local variables of every stack frame and any
  non-standard properties on the error object. discord.js API errors carry
  their status code, method, and route this way, and `ZodError` issues are
  flattened into readable context.
- Continuous profiling attaches CPU profiles to sampled traces in shard
  workers. `SENTRY_PROFILE_SESSION_SAMPLE_RATE` (0 to 1, default 0) enables
  and sets the profiling rate; trace sampling already bounds the volume, since profiles are only
  collected while a sampled trace is active.
- A watchdog thread reports when any thread in the cluster process blocks
  its event loop for more than a second, with a stack trace of where it was
  stuck.
- Node runtime metrics (event loop, GC, memory) flow to the Sentry metrics
  product alongside the OTLP metrics.
- When the optional [OFREP feature flag service](/development/features/)
  is configured, every flag evaluation is buffered and attached to error
  events, so an issue shows whether a remote override was active when
  things broke.
- A few measurements go to Sentry metrics exclusively: guild joins and
  leaves (with the guild's size and shard attached) and the wait imposed by
  each REST rate limit. Sentry metrics are per-item and stamped with the
  active trace, with no client-side aggregation, so they carry the rare,
  inspectable events; the aggregated [OTLP metrics](/self-hosting/metrics/)
  keep the high-volume series, and nothing is reported to both. Set
  `enableMetrics: false` in the telemetry config to turn them off.

Requests to third-party hosts never carry trace headers, so user-controlled
fetches and outside APIs can't see trace metadata. Two rules decide which
hosts do receive them:

- Sentry's `sentry-trace` and `baggage` headers are sent only to hosts in
  `tracePropagationTargets`, which is empty by default. Pass it to the
  telemetry config if you add an internal service that should join Sentry
  traces.
- W3C `traceparent` and `baggage` headers are sent only to internal targets,
  so a sidecar or internal service can join traces. Internal means
  loopback, private, and link-local addresses, `localhost`, single-label
  hostnames such as Docker Compose service names, and suffixes such as
  `.internal`, `.local`, `.lan`, and `.svc.cluster.local`. To treat more
  hosts as internal, list their hostnames, hostname suffixes, or IP
  addresses in `OTEL_TRACE_INTERNAL_TARGETS`, separated by commas.

:::note
For local development, set `SENTRY_SPOTLIGHT=true` to stream events to a
[Spotlight](https://spotlightjs.com/) sidecar instead of configuring a DSN.
:::

## What is instrumented

Commands and scheduled tasks run inside spans (`discord.command.<name>`,
`discord.task.<name>`), so database and HTTP calls made during them nest as
child spans. Auto-instrumentation covers PostgreSQL, Redis, and outbound HTTP,
plus Node runtime metrics (event loop delay and utilization, GC pauses,
heap spaces); each can be disabled with
`OTEL_INSTRUMENTATION_<PG|UNDICI|IOREDIS|FS|RUNTIME_NODE>_ENABLED=false`.

Logs are written to the console and mirrored as OTLP log records and Sentry
logs, with the configured log level applied to all three. Metrics cover the
full lifecycle of the bot; see the
[metrics reference](/self-hosting/metrics/).

## Terminal dashboard

When you start a cluster in an interactive terminal, for example with
`pnpm --filter @thesharks/discord start`, the cluster manager shows a
terminal dashboard instead of the plain log stream. It has an overview of
this cluster's shard workers, a searchable view of every metric the manager
and its workers have emitted, and the captured logs. The dashboard reads
metrics in-process every two seconds, so it works without a collector and
doesn't change what's exported over OTLP. It shows only the local cluster,
not other members of the fleet.

[`WILDBEAST_TUI`](/self-hosting/configuration/#core) controls it:

| Value | Behavior |
| --- | --- |
| `auto` (default) | Show the dashboard when both stdin and stdout are terminals and `CI` isn't set. |
| `on` | Same as `auto`, but also when `CI` is set. |
| `off` | Always write plain logs. |

Every mode falls back to plain logs when output is piped, stdin isn't a
terminal, or `TERM=dumb`. That covers process supervisors, containers
started without a TTY, and `pnpm dev`, which pipes the bot's output. Running
a shard worker directly with `start:worker` never shows the dashboard.

Press `?` for the key bindings. `q` detaches the dashboard and returns to
plain logs while the bot keeps running, and Ctrl+C starts the normal
[graceful shutdown](/self-hosting/running-in-production/). No key restarts
shards or changes configuration. The
[package README](https://github.com/TheSharks/WildBeast/tree/master/packages/tui)
lists every key and explains how the numbers are calculated.

## Troubleshooting

Set `OTEL_DIAGNOSTIC_LOG_LEVEL` (`error` … `debug`) to view the
OpenTelemetry SDK's own diagnostics, for example when the collector isn't
receiving data. On shutdown, pending telemetry uses a 10-second deadline by
default; shard workers use 5 seconds so their OpenTelemetry and Sentry flushes
fit inside the cluster manager's 20-second worker-stop grace.
