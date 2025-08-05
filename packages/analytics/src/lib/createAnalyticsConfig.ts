import { ElasticsearchLogsBackend } from '../backends/elasticsearch.js'
import { TimescaleDBBackend } from '../backends/timescaledb.js'
import type {
  AnalyticsConfig,
  ElasticsearchConfig,
  TimescaleDBConfig,
} from '../types.js'

export function createTimescaleElasticsearchAnalyticsConfig(): AnalyticsConfig {
  // TimescaleDB for metrics - use DATABASE_URL if available, fallback to individual params
  const timescaleConfig: TimescaleDBConfig = {
    connectionString: process.env.DATABASE_URL,
    maxConnections: process.env.TIMESCALE_MAX_CONNECTIONS
      ? parseInt(process.env.TIMESCALE_MAX_CONNECTIONS)
      : 10,
    idleTimeout: process.env.TIMESCALE_IDLE_TIMEOUT
      ? parseInt(process.env.TIMESCALE_IDLE_TIMEOUT)
      : 30000,
    connectionTimeout: process.env.TIMESCALE_CONNECTION_TIMEOUT
      ? parseInt(process.env.TIMESCALE_CONNECTION_TIMEOUT)
      : 2000,

    // Retention policies (long-term storage with eventual pruning)
    metricsRetentionDays: process.env.METRICS_RETENTION_DAYS
      ? parseInt(process.env.METRICS_RETENTION_DAYS)
      : 730, // 2 years
    metricsCompressionDays: process.env.METRICS_COMPRESSION_DAYS
      ? parseInt(process.env.METRICS_COMPRESSION_DAYS)
      : 30, // 30 days
    logsRetentionDays: process.env.LOGS_RETENTION_DAYS
      ? parseInt(process.env.LOGS_RETENTION_DAYS)
      : 365, // 1 year
    logsCompressionDays: process.env.LOGS_COMPRESSION_DAYS
      ? parseInt(process.env.LOGS_COMPRESSION_DAYS)
      : 7, // 7 days
  }

  // Fallback to individual params if DATABASE_URL is not available
  if (!timescaleConfig.connectionString) {
    timescaleConfig.host =
      process.env.TIMESCALE_HOST || process.env.DATABASE_HOST || 'localhost'
    timescaleConfig.port = process.env.TIMESCALE_PORT
      ? parseInt(process.env.TIMESCALE_PORT)
      : 5432
    timescaleConfig.database =
      process.env.TIMESCALE_DATABASE || process.env.DATABASE_NAME || 'wildbeast'
    timescaleConfig.user =
      process.env.TIMESCALE_USER || process.env.DATABASE_USER || 'postgres'
    timescaleConfig.password =
      process.env.TIMESCALE_PASSWORD ||
      process.env.DATABASE_PASSWORD ||
      'postgres'
    timescaleConfig.ssl = process.env.TIMESCALE_SSL === 'true' ? true : false
  }

  const metricsBackend = new TimescaleDBBackend(timescaleConfig)

  // Elasticsearch for logs
  const elasticsearchConfig: ElasticsearchConfig = {
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
    index: process.env.ELASTICSEARCH_LOGS_INDEX || 'wildbeast-logs',
    logsRetentionDays: process.env.LOGS_RETENTION_DAYS
      ? parseInt(process.env.LOGS_RETENTION_DAYS)
      : 365, // 1 year
  }

  if (
    process.env.ELASTICSEARCH_USERNAME &&
    process.env.ELASTICSEARCH_PASSWORD
  ) {
    elasticsearchConfig.auth = {
      username: process.env.ELASTICSEARCH_USERNAME,
      password: process.env.ELASTICSEARCH_PASSWORD,
    }
  }

  if (process.env.ELASTICSEARCH_API_KEY) {
    elasticsearchConfig.apiKey = process.env.ELASTICSEARCH_API_KEY
  }

  if (process.env.ELASTICSEARCH_CLOUD_ID) {
    elasticsearchConfig.cloud = {
      id: process.env.ELASTICSEARCH_CLOUD_ID,
    }
  }

  const logsBackend = new ElasticsearchLogsBackend(elasticsearchConfig)

  return {
    backend: metricsBackend,
    logsBackend,
    flushInterval: parseInt(process.env.METRICS_FLUSH_INTERVAL || '30000', 10),
    maxBatchSize: parseInt(process.env.METRICS_BATCH_SIZE || '100', 10),
    defaultLabels: {
      service: 'wildbeast-discord',
      version: process.env.npm_package_version || 'dev',
      environment: process.env.NODE_ENV || 'development',
    },
  }
}

// Backwards compatibility - creates the hybrid setup by default
export function createAnalyticsConfig(): AnalyticsConfig {
  return createTimescaleElasticsearchAnalyticsConfig()
}
