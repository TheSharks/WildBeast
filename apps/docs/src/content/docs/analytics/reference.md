---
title: Configuration reference
description: Every initOpenTelemetry option and environment variable, with defaults.
sidebar:
  order: 6
---

`initOpenTelemetry(config?)` takes one optional object and returns
`{ shutdown(): Promise<void> }`. Where an option and an environment variable
cover the same setting, the option wins.

## Entry points

| Import | Contents |
| --- | --- |
| `@thesharks/analytics` | `initOpenTelemetry`, `LocalMetricReader`, `Sentry`, the metric helpers, the OpenTelemetry API re-exports, and the config types. Doesn't load Sapphire or discord.js. |
| `@thesharks/analytics/register` | Side-effect import that installs `AnalyticsLogger` on every `SapphireClient`. Needs `@sapphire/framework`. |
| `@thesharks/analytics/bridges/sapphire-logger` | `AnalyticsLogger`, `LOGGER_PII_DENYLIST`, and the `@sapphire/plugin-logger` API. Needs `@sapphire/framework`. |

The package is ESM only and requires Node.js 22 or later.
`@sapphire/framework` and `discord.js` are optional peer dependencies, used
only by the two Sapphire entry points.

## Options

| Option | Default | Purpose |
| --- | --- | --- |
| `serviceName` | `OTEL_SERVICE_NAME`, then `@thesharks/discord` | The `service.name` resource attribute. |
| `namespace` | `@thesharks` | The `service.namespace` resource attribute. |
| `serviceVersion` | The Sentry release | The `service.version` resource attribute. |
| `environment` | `NODE_ENV`, then `development` | The `deployment.environment.name` resource attribute, and Sentry's environment. |
| `instanceId` | `shardId`, then the process ID | The `service.instance.id` resource attribute. |
| `shardId` | `SHARD_ID` | Used as the instance ID when `instanceId` is unset. |
| `resourceAttributes` | none | Extra resource attributes. The attributes above win on conflict. |
| `enableExport` | On when any endpoint is set | Forces OTLP export on or off. |
| `exporters` | From the environment | Exporter settings; see [Exporter options](#exporter-options). |
| `metricReaders` | none | Extra metric readers, such as a `LocalMetricReader`. They work with export off. |
| `instrumentations` | See [Auto-instrumentation](#auto-instrumentation) | Turns each auto-instrumentation on or off. |
| `sentry` | See [Sentry options](#sentry-options) | Sentry settings. |
| `shutdownTimeoutMillis` | `10000` | How long `shutdown` waits for pending exports. |
| `diagnosticLogLevel` | `OTEL_DIAGNOSTIC_LOG_LEVEL` | `'debug'` prints all SDK diagnostics. `'none'` silences them, including the variable. |

## Exporter options

`exporters` has four keys: `otlp` for every signal, and `traces`, `metrics`,
and `logs` for one. Each takes one exporter object or an array of them.
[Exporting telemetry](/analytics/exporting/) explains how they combine.

| Field | Purpose |
| --- | --- |
| `endpoint` | The collector URL. A `grpc://` or `grpcs://` scheme selects gRPC. |
| `protocol` | `'http'` or `'grpc'`. Overrides detection from the scheme. |
| `headers` | Headers to send, merged over the ones from the environment. |
| `timeout` | Request timeout in milliseconds. |
| `compression` | `'gzip'` or `'none'`. |

## Auto-instrumentation

Each instrumentation has an option under `instrumentations` and a variable.
Set the variable to `false` to turn one off, or `true` to turn one on.

| Option | Variable | Default | Instruments |
| --- | --- | --- | --- |
| `pg` | `OTEL_INSTRUMENTATION_PG_ENABLED` | on | PostgreSQL queries through `pg`. |
| `undici` | `OTEL_INSTRUMENTATION_UNDICI_ENABLED` | on | Outbound HTTP through `undici`, which includes Node.js `fetch`. |
| `ioredis` | `OTEL_INSTRUMENTATION_IOREDIS_ENABLED` | on | Redis commands through `ioredis`. |
| `runtimeNode` | `OTEL_INSTRUMENTATION_RUNTIME_NODE_ENABLED` | on | Node.js runtime metrics, such as event loop delay and heap use. |
| `fs` | `OTEL_INSTRUMENTATION_FS_ENABLED` | off | File system calls. It's noisy, so turn it on only while investigating. |

## Sentry options

All of these live under `sentry`. [Sentry](/analytics/sentry/) explains the
behavior behind them.

| Option | Default | Purpose |
| --- | --- | --- |
| `dsn` | `SENTRY_DSN` | Where to send events. Unset means Sentry sends nothing. |
| `environment` | The top-level `environment` | Sentry's environment. |
| `release` | `SENTRY_RELEASE`, then the package version, then `GIT_COMMIT`, then `dev` | Sentry's release. |
| `tracesSampleRate` | `0.2` in production, otherwise `1` | Share of traces to sample. |
| `tracesSampler` | none | Sampling function. Overrides `tracesSampleRate`. |
| `enableLogs` | `true` | Sends logs to Sentry. |
| `enableMetrics` | `true` | Enables Sentry metrics. |
| `includeLocalVariables` | `true` | Captures local variables in stack frames. |
| `tracePropagationTargets` | `[]` | Hosts that receive Sentry's trace headers. |
| `spotlight` | `SENTRY_SPOTLIGHT === 'true'` | Forwards events to a local Spotlight sidecar. |
| `tags` | none | Tags applied to every event from the process. |
| `profileSessionSampleRate` | `0` | Share of sessions to profile, from `0` to `1`. |
| `eventLoopBlockThreshold` | `1000` | Milliseconds before a blocked event loop is reported, or `false` to disable. |
| `beforeSend` | none | Runs after the built-in scrubber. Return `null` to drop the event. |

## Environment variables

`{SIGNAL}` stands for `TRACES`, `METRICS`, or `LOGS`.

| Variable | Purpose |
| --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Collector URL for every signal. The signal path is added for HTTP. |
| `OTEL_EXPORTER_OTLP_{SIGNAL}_ENDPOINT` | Collector URL for one signal, used exactly as written. |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `http/protobuf` or `grpc`, for every signal. |
| `OTEL_EXPORTER_OTLP_{SIGNAL}_PROTOCOL` | The protocol for one signal. |
| `OTEL_EXPORTER_OTLP_HEADERS` | Comma-separated `key=value` headers for every signal. |
| `OTEL_EXPORTER_OTLP_{SIGNAL}_HEADERS` | Headers for one signal, merged over the shared ones. |
| `OTEL_EXPORTER_OTLP_TIMEOUT` | Request timeout in milliseconds. |
| `OTEL_EXPORTER_OTLP_COMPRESSION` | `gzip` or `none`. |
| `OTEL_SERVICE_NAME` | The service name, when `serviceName` is unset. |
| `OTEL_DIAGNOSTIC_LOG_LEVEL` | SDK diagnostics: `none`, `error`, `warn`, `info`, `debug`, or `verbose`. |
| `OTEL_TRACE_INTERNAL_TARGETS` | Comma-separated extra hosts that may receive trace headers. |
| `SHARD_ID` | The shard ID, when `shardId` is unset. |
| `NODE_ENV` | The environment, when `environment` is unset. |
| `SENTRY_DSN` | The Sentry DSN, when `sentry.dsn` is unset. |
| `SENTRY_RELEASE` | The release, when `sentry.release` is unset. |
| `GIT_COMMIT` | The release, when nothing above it sets one. |
| `SENTRY_SPOTLIGHT` | `true` forwards events to a local Spotlight sidecar. |
| `SENTRY_VALIDATE_OTEL_SETUP` | `true` validates Sentry's OpenTelemetry wiring at boot. |
