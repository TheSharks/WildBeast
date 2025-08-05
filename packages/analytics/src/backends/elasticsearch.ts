import { Client, type estypes } from '@elastic/elasticsearch'
import { container } from '@sapphire/framework'
import type {
  ElasticsearchConfig,
  HealthCheckResult,
  LogEntry,
  LogLevel,
  LogsBackend,
  MetricLabels,
} from '../types.js'

export class ElasticsearchLogsBackend implements LogsBackend {
  private client: Client
  private indexPrefix: string
  private schemaEnsured = false
  private config: ElasticsearchConfig

  constructor(config: ElasticsearchConfig) {
    this.config = config
    this.client = new Client(config)
    this.indexPrefix = config.index || 'wildbeast-logs'
  }

  private getTimeBasedIndex(date: Date = new Date()): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    return `${this.indexPrefix}-${year}.${month}`
  }

  async write(logs: LogEntry[]): Promise<void> {
    if (logs.length === 0) return

    // Ensure schema is ready before first write
    if (!this.schemaEnsured) {
      try {
        await this.ensureSchema()
        this.schemaEnsured = true
      } catch (error) {
        // Don't fail writes due to template creation issues
        container.logger.warn(
          'Failed to ensure logs schema, continuing with write:',
          error,
        )
        this.schemaEnsured = true // Prevent repeated attempts
      }
    }

    const operations: unknown[] = []

    for (const log of logs) {
      const index = this.getTimeBasedIndex(log.timestamp)
      operations.push({ index: { _index: index } })

      const doc = {
        '@timestamp': log.timestamp,
        level: log.level,
        message: log.message,
        context: log.context,
        labels: log.labels || {},
      }

      operations.push(doc)
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.client.bulk({ operations })
        return // Exit if successful
      } catch (error) {
        if (attempt === 2) throw error // Rethrow on final attempt
        container.logger.warn(
          `Elasticsearch bulk write failed, retrying... (${attempt + 1}/3)`,
          error,
        )
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, attempt)),
        )
      }
    }
  }

  async query(filters?: {
    level?: LogLevel
    labels?: MetricLabels
    timeRange?: { start: Date; end: Date }
  }): Promise<LogEntry[]> {
    const mustClauses: estypes.QueryDslQueryContainer[] = []

    if (filters?.level) {
      mustClauses.push({
        term: { level: filters.level },
      })
    }

    if (filters?.labels) {
      for (const [key, value] of Object.entries(filters.labels)) {
        mustClauses.push({
          term: { [`labels.${key}`]: value },
        })
      }
    }

    if (filters?.timeRange) {
      mustClauses.push({
        range: {
          '@timestamp': {
            gte: filters.timeRange.start,
            lte: filters.timeRange.end,
          },
        },
      })
    }

    const query: estypes.QueryDslQueryContainer = {
      bool: {
        must: mustClauses,
      },
    }

    const response = await this.client.search({
      index: `${this.indexPrefix}-*`,
      query:
        query.bool &&
        query.bool.must &&
        Array.isArray(query.bool.must) &&
        query.bool.must.length > 0
          ? query
          : { match_all: {} },
      size: 10000,
      sort: [{ '@timestamp': { order: 'desc' } }],
    })

    return response.hits.hits.map((hit: estypes.SearchHit) => {
      const source = hit._source as unknown as {
        '@timestamp': string
        level: LogLevel
        message: string
        context?: Record<string, unknown>
        labels?: MetricLabels
      }
      return {
        timestamp: new Date(source['@timestamp']),
        level: source.level,
        message: source.message,
        context: source.context,
        labels: source.labels || {},
      }
    })
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const info = await this.client.info()
      return {
        healthy: true,
        info: {
          cluster_name: info.cluster_name,
          version: info.version.number,
          status: 'green',
        },
      }
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  private async ensureSchema(): Promise<void> {
    const templateName = 'wildbeast-logs'

    try {
      const exists = await this.client.indices.existsIndexTemplate({
        name: templateName,
      })
      if (exists) return

      await this.client.indices.putIndexTemplate({
        name: templateName,
        index_patterns: [`${this.indexPrefix}-*`],
        template: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            refresh_interval: '5s',
          },
          mappings: {
            properties: {
              '@timestamp': { type: 'date' },
              level: { type: 'keyword' },
              message: { type: 'text' },
              context: { type: 'object', dynamic: true },
              labels: { type: 'object', dynamic: true },
            },
          },
        },
      })

      container.logger.info(`Created index template: ${templateName}`)

      // Set up Index Lifecycle Management policy
      await this.ensureILMPolicy()
    } catch (error) {
      container.logger.warn(`Failed to create index template: ${error}`)
    }
  }

  private async ensureILMPolicy(): Promise<void> {
    try {
      const retentionDays = this.config.logsRetentionDays || 365 // 1 year default
      const policyName = 'wildbeast-logs-policy'

      // Check if policy already exists
      try {
        await this.client.ilm.getLifecycle({ name: policyName })
        return // Policy already exists
      } catch (error: unknown) {
        if (
          error &&
          typeof error === 'object' &&
          'statusCode' in error &&
          error.statusCode !== 404
        ) {
          throw error
        }
        // Policy doesn't exist, create it
      }

      await this.client.ilm.putLifecycle({
        name: policyName,
        policy: {
          phases: {
            hot: {
              actions: {
                rollover: {
                  max_size: '10gb',
                  max_age: '7d',
                },
              },
            },
            warm: {
              min_age: '7d',
              actions: {
                shrink: {
                  number_of_shards: 1,
                },
                forcemerge: {
                  max_num_segments: 1,
                },
              },
            },
            delete: {
              min_age: `${retentionDays}d`,
              actions: {
                delete: {},
              },
            },
          },
        },
      })

      container.logger.info(
        `Created ILM policy: ${policyName} with ${retentionDays} days retention`,
      )
    } catch (error) {
      // Don't fail schema creation if ILM policy fails
      container.logger.warn('Failed to set up ILM policy:', error)
    }
  }

  async close(): Promise<void> {
    await this.client.close()
  }
}
