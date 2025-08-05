# @thesharks/analytics

A portable analytics system for WildBeast that supports all Prometheus metric types with pluggable storage backends.

## Features

- **Prometheus-compatible metric types**: Counter, Gauge, Histogram, Summary
- **Pluggable storage backends**: TimescaleDB for metrics, Elasticsearch for logs, easy to add others
- **Worker thread friendly**: No complex shared state or coordination required
- **Automatic batching and flushing**: Configurable intervals and batch sizes
- **TypeScript support**: Fully typed for better developer experience

## Metric Types

### Counter

Monotonically increasing values (e.g., total requests, errors)

```typescript
const requestCounter = metrics.counter(
  "http_requests_total",
  "Total HTTP requests",
);
requestCounter.inc(1, { method: "GET", status: "200" });
```

### Gauge

Values that can go up and down (e.g., memory usage, active connections)

```typescript
const memoryGauge = metrics.gauge(
  "memory_usage_bytes",
  "Memory usage in bytes",
);
memoryGauge.set(process.memoryUsage().heapUsed);
```

### Histogram

Observations in configurable buckets (e.g., request duration, response sizes)

```typescript
const durationHistogram = metrics.histogram(
  "request_duration_seconds",
  "Request duration in seconds",
  [0.1, 0.5, 1, 2, 5], // Custom buckets
);
durationHistogram.observe(0.3, { endpoint: "/api/users" });
```

### Summary

Observations with configurable quantiles (e.g., response times)

```typescript
const responseSummary = metrics.summary(
  "response_time_seconds",
  "Response time in seconds",
  [0.5, 0.9, 0.95, 0.99], // Quantiles
);
responseSummary.observe(0.125, { service: "api" });
```

## Configuration

The analytics system is configured when initializing the registry:

```typescript
import {
  createRegistry,
  TimescaleDBBackend,
  setGlobalRegistry,
} from "@thesharks/analytics";

const backend = new TimescaleDBBackend({
  connectionString: "postgresql://user:password@localhost:5432/metrics",
  // Or individual connection options:
  // host: "localhost",
  // port: 5432,
  // database: "metrics",
  // user: "postgres",
  // password: "password",
  metricsRetentionDays: 730, // 2 years (default)
  metricsCompressionDays: 30, // 30 days (default)
});

const registry = createRegistry({
  backend,
  flushInterval: 30000, // Flush every 30 seconds
  maxBatchSize: 100, // Max 100 metrics per batch
  defaultLabels: {
    // Labels added to all metrics
    service: "my-app",
    version: "1.0.0",
  },
});

setGlobalRegistry(registry);
```

## Environment Variables

- `TIMESCALE_CONNECTION_STRING`: PostgreSQL/TimescaleDB connection string
- `TIMESCALE_HOST`: Database host
- `TIMESCALE_PORT`: Database port
- `TIMESCALE_DATABASE`: Database name
- `TIMESCALE_USER`: Database username
- `TIMESCALE_PASSWORD`: Database password
- `METRICS_RETENTION_DAYS`: How long to keep metrics data (default: 730)
- `METRICS_COMPRESSION_DAYS`: When to start compressing data (default: 30)
- `METRICS_FLUSH_INTERVAL`: How often to flush metrics (ms)
- `METRICS_BATCH_SIZE`: Maximum metrics per batch

## Storage Backends

Currently includes TimescaleDB backend for metrics storage. Elasticsearch backend is available for log storage. To implement a custom backend:

```typescript
import type {
  MetricsBackend,
  Metric,
  MetricLabels,
} from "@thesharks/analytics";

export class CustomBackend implements MetricsBackend {
  async write(metrics: Metric[]): Promise<void> {
    // Store metrics in your system
  }

  async query(
    name: string,
    labels?: MetricLabels,
    timeRange?: { start: Date; end: Date },
  ): Promise<Metric[]> {
    // Query metrics from your system
  }

  async close(): Promise<void> {
    // Cleanup resources
  }
}
```