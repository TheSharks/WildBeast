import { metrics, trace } from '@opentelemetry/api'
import { logs } from '@opentelemetry/api-logs'
import {
  InMemoryLogRecordExporter,
  LoggerProvider,
  type LogRecord,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs'
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
  type ResourceMetrics,
} from '@opentelemetry/sdk-metrics'
import {
  InMemorySpanExporter,
  type ReadableSpan,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'

export interface SpanCapture {
  spans(): ReadableSpan[]
  reset(): void
  shutdown(): Promise<void>
}

/** Install in-memory tracer; call before acquiring tracers. */
export function captureSpans(): SpanCapture {
  const exporter = new InMemorySpanExporter()
  const provider = new NodeTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  })
  // Allow repeats in one process.
  trace.disable()
  provider.register()
  return {
    spans: () => exporter.getFinishedSpans(),
    reset: () => exporter.reset(),
    shutdown: () => provider.shutdown(),
  }
}

export interface LogRecordCapture {
  records(): LogRecord[]
  reset(): void
  shutdown(): Promise<void>
}

/** Install in-memory logger; call before acquiring loggers. */
export function captureLogRecords(): LogRecordCapture {
  const exporter = new InMemoryLogRecordExporter()
  const provider = new LoggerProvider({
    processors: [new SimpleLogRecordProcessor({ exporter })],
  })
  logs.disable()
  logs.setGlobalLoggerProvider(provider)
  return {
    records: () => exporter.getFinishedLogRecords(),
    reset: () => exporter.reset(),
    shutdown: () => provider.shutdown(),
  }
}

export interface MetricCapture {
  /** Force collection of everything gathered so far. */
  collect(): Promise<ResourceMetrics[]>
  reset(): void
  shutdown(): Promise<void>
}

/**
 * Install in-memory meter; call before creating instruments. Delta reports since last collect; cumulative retains stopped gauges.
 */
export function captureMetrics(
  temporality: 'cumulative' | 'delta' = 'cumulative',
): MetricCapture {
  const exporter = new InMemoryMetricExporter(
    temporality === 'delta'
      ? AggregationTemporality.DELTA
      : AggregationTemporality.CUMULATIVE,
  )
  const reader = new PeriodicExportingMetricReader({
    exporter,
    // Never auto-export; collect() drives it.
    exportIntervalMillis: 3_600_000,
  })
  const provider = new MeterProvider({ readers: [reader] })
  metrics.disable()
  metrics.setGlobalMeterProvider(provider)
  return {
    async collect() {
      await reader.forceFlush()
      return exporter.getMetrics()
    },
    reset: () => exporter.reset(),
    shutdown: () => provider.shutdown(),
  }
}
