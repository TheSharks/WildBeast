import { container } from '@sapphire/pieces'
import { Counter } from '../metrics/counter.js'
import { Gauge } from '../metrics/gauge.js'
import { Histogram } from '../metrics/histogram.js'
import { Summary } from '../metrics/summary.js'
import type {
  AnalyticsConfig,
  LogEntry,
  LogLevel,
  Metric,
  MetricLabels,
} from '../types.js'

export class AnalyticsClient {
  private counters = new Map<string, Counter>()
  private gauges = new Map<string, Gauge>()
  private histograms = new Map<string, Histogram>()
  private summaries = new Map<string, Summary>()
  private logBuffer: LogEntry[] = []
  private flushTimer?: NodeJS.Timeout

  constructor(private config: AnalyticsConfig) {
    if (config.flushInterval && config.flushInterval > 0) {
      this.startAutoFlush()
    }

    // Graceful shutdown handlers
    process.on('SIGTERM', () => this.close())
    process.on('SIGINT', () => this.close())
  }

  counter(name: string, help: string, defaultLabels?: MetricLabels): Counter {
    if (!this.counters.has(name)) {
      const mergedLabels = { ...this.config.defaultLabels, ...defaultLabels }
      this.counters.set(name, new Counter(name, help, mergedLabels))
    }
    return this.counters.get(name)!
  }

  gauge(name: string, help: string, defaultLabels?: MetricLabels): Gauge {
    if (!this.gauges.has(name)) {
      const mergedLabels = { ...this.config.defaultLabels, ...defaultLabels }
      this.gauges.set(name, new Gauge(name, help, mergedLabels))
    }
    return this.gauges.get(name)!
  }

  histogram(
    name: string,
    help: string,
    buckets?: number[],
    defaultLabels?: MetricLabels,
  ): Histogram {
    if (!this.histograms.has(name)) {
      const mergedLabels = { ...this.config.defaultLabels, ...defaultLabels }
      this.histograms.set(
        name,
        new Histogram(name, help, buckets, mergedLabels),
      )
    }
    return this.histograms.get(name)!
  }

  summary(
    name: string,
    help: string,
    quantiles?: number[],
    defaultLabels?: MetricLabels,
  ): Summary {
    if (!this.summaries.has(name)) {
      const mergedLabels = { ...this.config.defaultLabels, ...defaultLabels }
      this.summaries.set(name, new Summary(name, help, quantiles, mergedLabels))
    }
    return this.summaries.get(name)!
  }

  log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    labels?: MetricLabels,
  ): void {
    const mergedLabels = { ...this.config.defaultLabels, ...labels }

    this.logBuffer.push({
      timestamp: new Date(),
      level,
      message,
      context,
      labels: mergedLabels,
    })
  }

  async collect(): Promise<Metric[]> {
    const metrics: Metric[] = []

    for (const counter of this.counters.values()) {
      metrics.push(counter.getMetric())
    }

    for (const gauge of this.gauges.values()) {
      metrics.push(gauge.getMetric())
    }

    for (const histogram of this.histograms.values()) {
      metrics.push(histogram.getMetric())
    }

    for (const summary of this.summaries.values()) {
      metrics.push(summary.getMetric())
    }

    return metrics
  }

  async flush(): Promise<void> {
    const metrics = await this.collect()

    if (metrics.length > 0) {
      const nonEmptyMetrics = metrics.filter((m) => m.samples.length > 0)

      if (nonEmptyMetrics.length > 0) {
        const batches = this.config.maxBatchSize
          ? this.chunkArray(nonEmptyMetrics, this.config.maxBatchSize)
          : [nonEmptyMetrics]

        for (const batch of batches) {
          await this.config.backend.write(batch)
        }
      }
    }

    if (this.logBuffer.length > 0 && this.config.logsBackend) {
      const logBatches = this.config.maxBatchSize
        ? this.chunkArray(this.logBuffer, this.config.maxBatchSize)
        : [this.logBuffer]

      for (const batch of logBatches) {
        await this.config.logsBackend.write(batch)
      }

      this.logBuffer = []
    }

    this.reset()
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  private reset(): void {
    // Only clear samples/observations, not the metric state
    for (const counter of this.counters.values()) {
      counter.getAndClearSamples() // Don't reset counter values, just clear samples
    }
    for (const gauge of this.gauges.values()) {
      gauge.getAndClearSamples() // Don't reset gauge values, just clear samples
    }
    for (const histogram of this.histograms.values()) {
      histogram.getAndClearObservations() // Clear observations
    }
    for (const summary of this.summaries.values()) {
      summary.getAndClearObservations() // Clear observations
    }
  }

  private startAutoFlush(): void {
    this.flushTimer = setInterval(async () => {
      try {
        await this.flush()
      } catch (error) {
        container.logger.error('Failed to flush metrics:', error)
      }
    }, this.config.flushInterval)
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = undefined
    }

    try {
      await this.flush()
      await this.config.backend.close()
      if (this.config.logsBackend) {
        await this.config.logsBackend.close()
      }
    } catch (error) {
      container.logger.error('Error during analytics client shutdown:', error)
    }
  }
}
