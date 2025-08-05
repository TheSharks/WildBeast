import type { GaugeMetric, MetricLabels, MetricSample } from '../types.js'

export class Gauge {
  private samples: MetricSample[] = []
  private currentValues: Map<string, MetricSample> = new Map()

  constructor(
    private name: string,
    private help: string,
    private defaultLabels: MetricLabels = {},
  ) {}

  set(value: number, labels: MetricLabels = {}): void {
    const mergedLabels = { ...this.defaultLabels, ...labels }
    const labelKey = JSON.stringify(mergedLabels)

    const sample: MetricSample = {
      value,
      timestamp: new Date(),
      labels: mergedLabels,
    }

    this.currentValues.set(labelKey, sample)
    this.samples.push(sample)
  }

  inc(value = 1, labels: MetricLabels = {}): void {
    const mergedLabels = { ...this.defaultLabels, ...labels }
    const labelKey = JSON.stringify(mergedLabels)
    const current = this.currentValues.get(labelKey)

    const newValue = (current?.value || 0) + value
    this.set(newValue, labels)
  }

  dec(value = 1, labels: MetricLabels = {}): void {
    this.inc(-value, labels)
  }

  getValue(labels: MetricLabels = {}): number {
    const mergedLabels = { ...this.defaultLabels, ...labels }
    const labelKey = JSON.stringify(mergedLabels)
    return this.currentValues.get(labelKey)?.value || 0
  }

  getMetric(): GaugeMetric {
    return {
      type: 'gauge',
      name: this.name,
      help: this.help,
      samples: [...this.samples],
    }
  }

  // Get current values only (most recent per label set)
  getCurrentValues(): MetricSample[] {
    return Array.from(this.currentValues.values())
  }

  // Get samples since last flush for batching
  getAndClearSamples(): MetricSample[] {
    const samples = [...this.samples]
    this.samples = []
    return samples
  }

  reset(): void {
    this.samples = []
    this.currentValues.clear()
  }
}
