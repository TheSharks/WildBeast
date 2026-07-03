# @thesharks/analytics

OpenTelemetry-first analytics helpers for WildBeast. This package provides:
- `initOpenTelemetry` bootstrap for traces/metrics/logs
- Sapphire logger bridge (`AnalyticsLogger`)
- OpenTelemetry API re-exports (`metrics`, `logs`, `trace`)

## OpenTelemetry Bootstrap

The shared bootstrap configures traces, metrics, and logs via OTLP HTTP or gRPC exporters. The bootstrap automatically configures exporters for all signals when an OTLP endpoint is provided. If no endpoint is set, exporters remain disabled unless `enableExport` is explicitly set to `true`. The bootstrap enables the `pg`, `undici`, `ioredis` and `runtime-node` auto-instrumentations by default (disable via config or environment variables).

Common config knobs in `initOpenTelemetry`:
- `serviceName`, `serviceVersion`, `namespace`, `environment`, `instanceId`, `shardId`
- `enableExport` to force exporters on/off
- `shutdownTimeoutMillis` to bound telemetry flushing on shutdown (default 10s)
- `exporters` to override OTLP endpoints/headers/protocol/timeout/compression per signal
- `instrumentations` to toggle `pg`, `undici`, `ioredis`, `fs` and `runtimeNode`
- `sentry` to override `dsn`, `tracesSampleRate`, `tracesSampler`, `environment`, `release`

### Exporter Configuration

Each signal (traces, metrics, logs) can be configured with:
- `endpoint`: OTLP endpoint URL (e.g., `http://localhost:4317` or `grpc://localhost:4317`)
- `headers`: Custom headers for the exporter
- `protocol`: Explicitly set `'http'` or `'grpc'` (optional, auto-detected from endpoint URL)
- `timeout`: Request timeout in milliseconds (optional)
- `compression`: Compression setting (`'gzip'` or `'none'`, optional)

**Protocol Selection:**
Protocol is determined by precedence:
1. Config field: `protocol: 'http' | 'grpc'`
2. Signal-specific env var: `OTEL_EXPORTER_OTLP_{SIGNAL}_PROTOCOL`
3. Global env var: `OTEL_EXPORTER_OTLP_PROTOCOL`
4. URL scheme detection: `grpc://` or `grpcs://` → gRPC, otherwise HTTP

**Multiple Exporters:**
Each signal can have multiple exporters configured as an array:
```typescript
exporters: {
  traces: [
    { endpoint: "http://primary:4317", headers: { "X-Primary": "true" } },
    { endpoint: "http://secondary:4317", headers: { "X-Secondary": "true" } },
  ]
}
```

Example exporter override:

```typescript
const telemetry = initOpenTelemetry({
  enableExport: true,
  exporters: {
    otlp: { 
      endpoint: "http://localhost:4317",
      headers: { "Authorization": "Bearer token" },
    },
    traces: { 
      endpoint: "grpc://localhost:4317",
      timeout: 30000,
      compression: "gzip",
    },
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
- `OTEL_EXPORTER_OTLP_ENDPOINT`: Base OTLP endpoint (e.g., `http://localhost:4317` or `grpc://localhost:4317`)

**Endpoints (optional):**
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`: Overrides traces endpoint
- `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`: Overrides metrics endpoint
- `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT`: Overrides logs endpoint

**Headers (optional):**
Format: Comma-separated key=value pairs (e.g., `Authorization=Bearer token,X-Custom-Header=value`)
- `OTEL_EXPORTER_OTLP_HEADERS`: Global headers for all OTLP exporters
- `OTEL_EXPORTER_OTLP_TRACES_HEADERS`: Traces-specific headers
- `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`: Metrics-specific headers
- `OTEL_EXPORTER_OTLP_LOGS_HEADERS`: Logs-specific headers

**Protocol (optional):**
- `OTEL_EXPORTER_OTLP_PROTOCOL`: Global protocol: `http/protobuf` or `grpc`
- `OTEL_EXPORTER_OTLP_TRACES_PROTOCOL`: Traces-specific protocol
- `OTEL_EXPORTER_OTLP_METRICS_PROTOCOL`: Metrics-specific protocol
- `OTEL_EXPORTER_OTLP_LOGS_PROTOCOL`: Logs-specific protocol

**Timeout (optional):**
- `OTEL_EXPORTER_OTLP_TIMEOUT`: Request timeout in milliseconds

**Compression (optional):**
- `OTEL_EXPORTER_OTLP_COMPRESSION`: Compression setting: `gzip` or `none`

**Service Configuration (optional):**
- `OTEL_SERVICE_NAME`: Overrides service name
- `OTEL_DIAGNOSTIC_LOG_LEVEL`: Set to `verbose` to enable OTEL diagnostics
- `OTEL_INSTRUMENTATION_PG_ENABLED`: Set to `false` to disable pg instrumentation
- `OTEL_INSTRUMENTATION_UNDICI_ENABLED`: Set to `false` to disable undici instrumentation

**Sentry (optional):**
- `SENTRY_DSN`: Sentry DSN for error tracing
- `SENTRY_VALIDATE_OTEL_SETUP`: Set to `true` to validate OTEL setup on boot (throws if validation fails)

## End-to-end testing

`test/collector.e2e.test.ts` verifies the full pipeline against a real OpenTelemetry collector (both OTLP/HTTP and OTLP/gRPC). The easiest way to run it is the repo-wide integration runner, which provisions the collector (and Redis) in docker automatically:

```sh
pnpm test:integration # from the repo root
```

To run it manually instead, it is skipped unless `OTEL_E2E_OUTPUT` is set:

```sh
mkdir -p /tmp/otel-e2e && chmod 777 /tmp/otel-e2e
docker run --rm -d --name otel-e2e \
  -p 14317:4317 -p 14318:4318 \
  -v $PWD/test/fixtures/otel-collector.yaml:/etc/otelcol-contrib/config.yaml \
  -v /tmp/otel-e2e:/out \
  otel/opentelemetry-collector-contrib:latest
pnpm build # scenarios boot the real pipeline from dist
OTEL_E2E_OUTPUT=/tmp/otel-e2e/telemetry.json pnpm test
docker rm -f otel-e2e
```
