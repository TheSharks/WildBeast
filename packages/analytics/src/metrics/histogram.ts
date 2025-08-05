import type { HistogramMetric, MetricLabels, HistogramObservation } from '../types.js';

const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, Infinity];

export class Histogram {
  private observations: HistogramObservation[] = [];
  private bucketBoundaries: number[];

  constructor(
    private name: string,
    private help: string,
    buckets: number[] = DEFAULT_BUCKETS,
    private defaultLabels: MetricLabels = {}
  ) {
    this.bucketBoundaries = [...buckets].sort((a, b) => a - b);
    if (this.bucketBoundaries[this.bucketBoundaries.length - 1] !== Infinity) {
      this.bucketBoundaries.push(Infinity);
    }
  }

  observe(value: number, labels: MetricLabels = {}): void {
    if (value < 0) {
      throw new Error('Histogram observations must be non-negative');
    }

    const mergedLabels = { ...this.defaultLabels, ...labels };
    
    this.observations.push({
      value,
      timestamp: new Date(),
      labels: mergedLabels
    });
  }

  getMetric(): HistogramMetric {
    return {
      type: 'histogram',
      name: this.name,
      help: this.help,
      samples: [...this.observations],
      buckets: [...this.bucketBoundaries]
    };
  }

  // Get observations since last flush for batching
  getAndClearObservations(): HistogramObservation[] {
    const observations = [...this.observations];
    this.observations = [];
    return observations;
  }

  // Get current statistics (for in-memory queries)
  getStats(labels?: MetricLabels): { count: number; sum: number; min: number; max: number; mean: number } {
    let filteredObs = this.observations;
    
    if (labels) {
      filteredObs = this.observations.filter(obs => 
        JSON.stringify({ ...this.defaultLabels, ...obs.labels }) === JSON.stringify({ ...this.defaultLabels, ...labels })
      );
    }

    if (filteredObs.length === 0) {
      return { count: 0, sum: 0, min: 0, max: 0, mean: 0 };
    }

    const values = filteredObs.map(obs => obs.value);
    const sum = values.reduce((a, b) => a + b, 0);
    const count = values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const mean = sum / count;

    return { count, sum, min, max, mean };
  }

  reset(): void {
    this.observations = [];
  }
}