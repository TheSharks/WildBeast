export interface MetricLabels {
  [key: string]: string | number;
}

export interface MetricSample {
  value: number;
  timestamp: Date;
  labels: MetricLabels;
}

export interface CounterSample {
  value: number;
  timestamp: Date;
  labels: MetricLabels;
}

export interface CounterMetric {
  type: "counter";
  name: string;
  help: string;
  samples: CounterSample[];
}

export interface GaugeMetric {
  type: "gauge";
  name: string;
  help: string;
  samples: MetricSample[];
}

export interface HistogramBucket {
  le: number;
  count: number;
}

export interface HistogramObservation {
  value: number;
  timestamp: Date;
  labels: MetricLabels;
}

export interface HistogramMetric {
  type: "histogram";
  name: string;
  help: string;
  samples: HistogramObservation[];
  buckets?: number[]; // Configuration for bucket boundaries
}

export interface SummaryQuantile {
  quantile: number;
  value: number;
}

export interface SummaryObservation {
  value: number;
  timestamp: Date;
  labels: MetricLabels;
}

export interface SummaryMetric {
  type: "summary";
  name: string;
  help: string;
  samples: SummaryObservation[];
  quantiles?: number[]; // Configuration for quantile calculations
}

export type Metric =
  | CounterMetric
  | GaugeMetric
  | HistogramMetric
  | SummaryMetric;

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: any;
  labels?: MetricLabels;
}

export interface HealthCheckResult {
  healthy: boolean;
  info?: any;
  error?: string;
}

export interface MetricsBackend {
  write(metrics: Metric[]): Promise<void>;
  query(
    name: string,
    labels?: MetricLabels,
    timeRange?: { start: Date; end: Date },
  ): Promise<Metric[]>;
  healthCheck(): Promise<HealthCheckResult>;
  close(): Promise<void>;
}

export interface LogsBackend {
  write(logs: LogEntry[]): Promise<void>;
  query(filters?: {
    level?: LogLevel;
    labels?: MetricLabels;
    timeRange?: { start: Date; end: Date };
  }): Promise<LogEntry[]>;
  healthCheck(): Promise<HealthCheckResult>;
  close(): Promise<void>;
}

export interface AnalyticsConfig {
  backend: MetricsBackend;
  logsBackend?: LogsBackend;
  flushInterval?: number;
  maxBatchSize?: number;
  defaultLabels?: MetricLabels;
}

export interface ElasticsearchConfig {
  node: string;
  auth?: {
    username: string;
    password: string;
  };
  apiKey?: string;
  index?: string;
  cloud?: {
    id: string;
  };

  // Index Lifecycle Management
  logsRetentionDays?: number; // Default: 1 year (365 days)
}

export interface TimescaleDBConfig {
  connectionString?: string; // DATABASE_URL
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | object;
  maxConnections?: number;
  idleTimeout?: number;
  connectionTimeout?: number;

  // Retention policies
  metricsRetentionDays?: number; // Default: 2 years (730 days)
  metricsCompressionDays?: number; // Default: 30 days
  logsRetentionDays?: number; // Default: 1 year (365 days)
  logsCompressionDays?: number; // Default: 7 days
}
