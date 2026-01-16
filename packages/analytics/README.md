# @thesharks/analytics

OpenTelemetry-first analytics helpers for WildBeast. This package provides:
- `initOpenTelemetry` bootstrap for traces/metrics/logs
- Sapphire logger bridge (`AnalyticsLogger`)
- OpenTelemetry API re-exports (`metrics`, `logs`, `trace`)

## OpenTelemetry Bootstrap

The shared bootstrap configures traces, metrics, and logs via OTLP gRPC. The bootstrap wires OTLP gRPC exporters for all signals when an OTLP endpoint is provided. If no endpoint is set, exporters remain disabled unless `enableExport` is explicitly set to `true`. The bootstrap enables both `pg` and `undici` auto-instrumentations by default (disable via config or environment variables).

Common config knobs in `initOpenTelemetry`:
- `serviceName`, `serviceVersion`, `namespace`, `environment`, `instanceId`, `shardId`
- `enableExport` to force exporters on/off
- `exporters` to override OTLP endpoints/headers per signal
- `instrumentations` to toggle `pg` and `undici`
- `sentry` to override `dsn`, `tracesSampleRate`, `environment`, `release`

Example exporter override:

```typescript
const telemetry = initOpenTelemetry({
  enableExport: true,
  exporters: {
    otlp: { endpoint: "http://localhost:4317" },
    logs: { endpoint: "http://localhost:4319" },
  },
});
```

```typescript
import { initOpenTelemetry } from "@thesharks/analytics";

const telemetry = initOpenTelemetry({
  serviceName: "@thesharks/discord",
  namespace: "@thesharks",
  shardId: process.env.SHARD_ID,
  instrumentations: {
    pg: true,
    undici: true,
  },
});

process.once("SIGINT", () => telemetry.shutdown());
process.once("SIGTERM", () => telemetry.shutdown());
```

## API Overview

This package exports the OpenTelemetry API for creating metrics, logs, and traces. Use `metrics.getMeter`, `logs.getLogger`, and `trace.getTracer` to instrument your application.

## OTel API Usage

```typescript
import { metrics, logs, trace } from "@thesharks/analytics";

const meter = metrics.getMeter("@thesharks/discord");
const logger = logs.getLogger("@thesharks/discord");
const tracer = trace.getTracer("@thesharks/discord");

const guildGauge = meter.createObservableGauge("discord_guilds_total", {
  description: "Total number of Discord guilds the bot is in",
});

logger.emit({
  severityText: "info",
  body: "Telemetry initialized",
});
```

## Sapphire Logger Bridge

The `AnalyticsLogger` extends Sapphire's logger to automatically send logs to both OpenTelemetry and Sentry:

```typescript
import { AnalyticsLogger } from "@thesharks/analytics";

const client = new SapphireClient({
  logger: {
    instance: new AnalyticsLogger(),
  },
});
```

The AnalyticsLogger sends all Sapphire logs to three destinations:
1. Console (standard behavior)
2. OpenTelemetry as log records
3. Sentry using the Logs API (trace, debug, info, warn, error, fatal)

Sentry Logs integration is enabled by default and requires `@sentry/node` v9.41.0 or later.

## Environment Variables

### OpenTelemetry

**Required (for export):**
- `OTEL_EXPORTER_OTLP_ENDPOINT`: Base OTLP gRPC endpoint (e.g. `http://localhost:4317`)

**Optional:**
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`: Overrides traces endpoint
- `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`: Overrides metrics endpoint
- `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT`: Overrides logs endpoint
- `OTEL_SERVICE_NAME`: Overrides service name
- `OTEL_DIAGNOSTIC_LOG_LEVEL`: Set to enable verbose OTEL diagnostics
- `OTEL_INSTRUMENTATION_PG_ENABLED`: Set to `false` to disable pg instrumentation
- `OTEL_INSTRUMENTATION_UNDICI_ENABLED`: Set to `false` to disable undici instrumentation
- `SENTRY_DSN`: Sentry DSN for error tracing
- `SENTRY_VALIDATE_OTEL_SETUP`: Set to `true` to validate OTEL setup on boot (throws if validation fails)
