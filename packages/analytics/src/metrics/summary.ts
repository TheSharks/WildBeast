import type {
  MetricLabels,
  SummaryMetric,
  SummaryObservation,
  SummaryQuantile,
} from '../types.js'

const DEFAULT_QUANTILES = [0.5, 0.9, 0.95, 0.99]

export class Summary {
  private observations: SummaryObservation[] = []
  private quantileConfig: number[]

  constructor(
    private name: string,
    private help: string,
    quantiles: number[] = DEFAULT_QUANTILES,
    private defaultLabels: MetricLabels = {},
  ) {
    this.quantileConfig = [...quantiles].sort((a, b) => a - b)
  }

  observe(value: number, labels: MetricLabels = {}): void {
    if (value < 0) {
      throw new Error('Summary observations must be non-negative')
    }

    const mergedLabels = { ...this.defaultLabels, ...labels }

    this.observations.push({
      value,
      timestamp: new Date(),
      labels: mergedLabels,
    })
  }

  getMetric(): SummaryMetric {
    return {
      type: 'summary',
      name: this.name,
      help: this.help,
      samples: [...this.observations],
      quantiles: [...this.quantileConfig],
    }
  }

  // Get observations since last flush for batching
  getAndClearObservations(): SummaryObservation[] {
    const observations = [...this.observations]
    this.observations = []
    return observations
  }

  // Get current statistics (for in-memory queries)
  getStats(labels?: MetricLabels): {
    count: number
    sum: number
    min: number
    max: number
    mean: number
  } {
    let filteredObs = this.observations

    if (labels) {
      filteredObs = this.observations.filter(
        (obs) =>
          JSON.stringify({ ...this.defaultLabels, ...obs.labels }) ===
          JSON.stringify({ ...this.defaultLabels, ...labels }),
      )
    }

    if (filteredObs.length === 0) {
      return { count: 0, sum: 0, min: 0, max: 0, mean: 0 }
    }

    const values = filteredObs.map((obs) => obs.value)
    const sum = values.reduce((a, b) => a + b, 0)
    const count = values.length
    const min = Math.min(...values)
    const max = Math.max(...values)
    const mean = sum / count

    return { count, sum, min, max, mean }
  }

  // Calculate quantiles from in-memory observations
  getQuantiles(
    labels?: MetricLabels,
    quantiles: number[] = this.quantileConfig,
  ): SummaryQuantile[] {
    let filteredObs = this.observations

    if (labels) {
      filteredObs = this.observations.filter(
        (obs) =>
          JSON.stringify({ ...this.defaultLabels, ...obs.labels }) ===
          JSON.stringify({ ...this.defaultLabels, ...labels }),
      )
    }

    if (filteredObs.length === 0) {
      return quantiles.map((q) => ({ quantile: q, value: 0 }))
    }

    const values = filteredObs.map((obs) => obs.value).sort((a, b) => a - b)

    return quantiles.map((quantile) => {
      const index = Math.ceil(values.length * quantile) - 1
      return {
        quantile,
        value: values[Math.max(0, index)],
      }
    })
  }

  reset(): void {
    this.observations = []
  }
}
