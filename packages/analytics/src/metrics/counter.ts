import type { CounterMetric, CounterSample, MetricLabels } from '../types.js'

export class Counter {
  private samples: CounterSample[] = []
  private cumulativeValues: Map<string, number> = new Map()

  constructor(
    private name: string,
    private help: string,
    private defaultLabels: MetricLabels = {},
  ) {}

  inc(increment = 1, labels: MetricLabels = {}): void {
    if (increment <= 0) {
      throw new Error('Counter increments must be positive')
    }

    const mergedLabels = { ...this.defaultLabels, ...labels }
    const labelKey = JSON.stringify(mergedLabels)

    // Update cumulative value for monotonic behavior
    const currentValue = this.cumulativeValues.get(labelKey) || 0
    const newValue = currentValue + increment
    this.cumulativeValues.set(labelKey, newValue)

    // Store the actual counter value (not delta) for TimescaleDB
    this.samples.push({
      value: newValue,
      timestamp: new Date(),
      labels: mergedLabels,
    })
  }

  getValue(labels: MetricLabels = {}): number {
    const mergedLabels = { ...this.defaultLabels, ...labels }
    const labelKey = JSON.stringify(mergedLabels)
    return this.cumulativeValues.get(labelKey) || 0
  }

  getMetric(): CounterMetric {
    return {
      type: 'counter',
      name: this.name,
      help: this.help,
      samples: [...this.samples],
    }
  }

  reset(): void {
    this.samples = []
    this.cumulativeValues.clear()
  }

  // Get samples since last flush for batching
  getAndClearSamples(): CounterSample[] {
    const samples = [...this.samples]
    this.samples = []
    return samples
  }
}
