import type { Attributes } from '@opentelemetry/api'
import { DataPointType, MetricReader } from '@opentelemetry/sdk-metrics'

/** Structured-clone safe metric data for local inspection and worker IPC. */
export interface LocalMetricPoint {
  name: string
  description: string
  unit: string
  meter: string
  attributes: Attributes
  kind: 'counter' | 'gauge' | 'histogram'
  value: number
  startTime: number
  count?: number
  sum?: number
  min?: number
  max?: number
}

export interface LocalMetricSnapshot {
  collectedAt: number
  points: LocalMetricPoint[]
  errors: number
  truncated: boolean
}

/** Pull-based cumulative reader; never exports data or drains other readers. */
export class LocalMetricReader extends MetricReader {
  constructor() {
    super({ cardinalitySelector: () => 200 })
  }

  async snapshot(): Promise<LocalMetricSnapshot> {
    const { resourceMetrics, errors } = await this.collect({
      timeoutMillis: 1_000,
    })
    const points: LocalMetricPoint[] = []
    let truncated = false
    for (const scope of resourceMetrics.scopeMetrics) {
      for (const metric of scope.metrics) {
        for (const point of metric.dataPoints) {
          if (points.length >= 2_000) {
            truncated = true
            break
          }
          const base = {
            ...metric.descriptor,
            meter: scope.scope.name,
            attributes: point.attributes,
            startTime: point.startTime[0] * 1_000 + point.startTime[1] / 1e6,
          }
          if (typeof point.value === 'number') {
            if (!Number.isFinite(point.value)) continue
            points.push({
              ...base,
              kind:
                metric.dataPointType === DataPointType.SUM && metric.isMonotonic
                  ? 'counter'
                  : 'gauge',
              value: point.value,
            })
          } else {
            const { count, sum, min, max } = point.value
            points.push({
              ...base,
              kind: 'histogram',
              value: count && sum !== undefined ? sum / count : 0,
              count,
              sum,
              min,
              max,
            })
          }
        }
      }
    }
    return { collectedAt: Date.now(), points, errors: errors.length, truncated }
  }

  protected async onForceFlush(): Promise<void> {
    // Pull-only reader: there is no exporter to flush.
  }
  protected async onShutdown(): Promise<void> {
    // The reader owns no timers or connections.
  }
}
