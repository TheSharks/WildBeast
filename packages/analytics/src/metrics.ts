import { register, collectDefaultMetrics, Counter, Gauge, Histogram, Summary } from 'prom-client';
import { createServer } from 'http';

export interface MetricEvent {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: Date;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
}

export interface PrometheusConfig {
  port: number;
  path: string;
}

export class MetricsCollector {
  private metrics: Map<string, Counter | Gauge | Histogram | Summary> = new Map();
  private server?: ReturnType<typeof createServer>;
  private config: PrometheusConfig;

  constructor(config: PrometheusConfig) {
    this.config = config;
    
    // Collect default metrics (CPU, memory, etc.)
    collectDefaultMetrics({ register });
    
    // Discord-specific metrics
    this.createDiscordMetrics();
  }

  private createDiscordMetrics(): void {
    // Bot metrics
    this.metrics.set('discord_commands_total', new Counter({
      name: 'discord_commands_total',
      help: 'Total number of Discord commands executed',
      labelNames: ['command', 'guild_id', 'user_id', 'status'],
    }));

    this.metrics.set('discord_messages_total', new Counter({
      name: 'discord_messages_total',
      help: 'Total number of Discord messages processed',
      labelNames: ['guild_id', 'channel_id', 'type'],
    }));

    this.metrics.set('discord_guilds_total', new Gauge({
      name: 'discord_guilds_total',
      help: 'Total number of guilds the bot is in',
    }));

    this.metrics.set('discord_users_total', new Gauge({
      name: 'discord_users_total',
      help: 'Total number of users the bot can see',
    }));

    // Performance metrics
    this.metrics.set('discord_command_duration_seconds', new Histogram({
      name: 'discord_command_duration_seconds',
      help: 'Duration of Discord command execution in seconds',
      labelNames: ['command', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    }));

    this.metrics.set('discord_api_requests_total', new Counter({
      name: 'discord_api_requests_total',
      help: 'Total number of Discord API requests',
      labelNames: ['endpoint', 'method', 'status'],
    }));

    this.metrics.set('discord_api_rate_limit_hits_total', new Counter({
      name: 'discord_api_rate_limit_hits_total',
      help: 'Total number of Discord API rate limit hits',
      labelNames: ['endpoint'],
    }));

    // System metrics
    this.metrics.set('analytics_events_processed_total', new Counter({
      name: 'analytics_events_processed_total',
      help: 'Total number of analytics events processed',
      labelNames: ['event_type', 'source'],
    }));

    this.metrics.set('analytics_queue_size', new Gauge({
      name: 'analytics_queue_size',
      help: 'Current size of the analytics processing queue',
      labelNames: ['queue_name'],
    }));

    this.metrics.set('analytics_processing_duration_seconds', new Histogram({
      name: 'analytics_processing_duration_seconds',
      help: 'Duration of analytics processing in seconds',
      labelNames: ['operation'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10],
    }));

    // Error metrics
    this.metrics.set('errors_total', new Counter({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['source', 'type', 'severity'],
    }));

    // Database metrics
    this.metrics.set('database_queries_total', new Counter({
      name: 'database_queries_total',
      help: 'Total number of database queries',
      labelNames: ['operation', 'table', 'status'],
    }));

    this.metrics.set('database_query_duration_seconds', new Histogram({
      name: 'database_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
    }));
  }

  async initialize(): Promise<void> {
    // Start HTTP server for metrics endpoint
    this.server = createServer(async (req, res) => {
      if (req.url === this.config.path) {
        res.setHeader('Content-Type', register.contentType);
        res.end(await register.metrics());
      } else {
        res.statusCode = 404;
        res.end('Not Found');
      }
    });

    this.server.listen(this.config.port, () => {
      console.log(`Metrics server listening on port ${this.config.port}`);
    });
  }

  recordMetric(event: MetricEvent): void {
    const metric = this.metrics.get(event.name);
    if (!metric) {
      console.warn(`Unknown metric: ${event.name}`);
      return;
    }

    try {
      switch (event.type) {
        case 'counter':
          if (metric instanceof Counter) {
            metric.inc(event.labels || {}, event.value);
          }
          break;
        case 'gauge':
          if (metric instanceof Gauge) {
            metric.set(event.labels || {}, event.value);
          }
          break;
        case 'histogram':
          if (metric instanceof Histogram) {
            metric.observe(event.labels || {}, event.value);
          }
          break;
        case 'summary':
          if (metric instanceof Summary) {
            metric.observe(event.labels || {}, event.value);
          }
          break;
      }
    } catch (error) {
      console.error('Failed to record metric:', error);
    }
  }

  // Helper methods for common metrics
  incrementCounter(name: string, labels?: Record<string, string>, value: number = 1): void {
    this.recordMetric({
      name,
      value,
      labels,
      timestamp: new Date(),
      type: 'counter',
    });
  }

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric({
      name,
      value,
      labels,
      timestamp: new Date(),
      type: 'gauge',
    });
  }

  observeHistogram(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric({
      name,
      value,
      labels,
      timestamp: new Date(),
      type: 'histogram',
    });
  }

  // Discord-specific helper methods
  recordCommand(command: string, guildId: string, userId: string, status: 'success' | 'error' | 'timeout'): void {
    this.incrementCounter('discord_commands_total', {
      command,
      guild_id: guildId,
      user_id: userId,
      status,
    });
  }

  recordCommandDuration(command: string, duration: number, status: 'success' | 'error' | 'timeout'): void {
    this.observeHistogram('discord_command_duration_seconds', duration, {
      command,
      status,
    });
  }

  recordApiRequest(endpoint: string, method: string, status: string): void {
    this.incrementCounter('discord_api_requests_total', {
      endpoint,
      method,
      status,
    });
  }

  recordRateLimitHit(endpoint: string): void {
    this.incrementCounter('discord_api_rate_limit_hits_total', {
      endpoint,
    });
  }

  updateGuildCount(count: number): void {
    this.setGauge('discord_guilds_total', count);
  }

  updateUserCount(count: number): void {
    this.setGauge('discord_users_total', count);
  }

  recordAnalyticsEvent(eventType: string, source: string): void {
    this.incrementCounter('analytics_events_processed_total', {
      event_type: eventType,
      source,
    });
  }

  updateQueueSize(queueName: string, size: number): void {
    this.setGauge('analytics_queue_size', size, {
      queue_name: queueName,
    });
  }

  recordError(source: string, type: string, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    this.incrementCounter('errors_total', {
      source,
      type,
      severity,
    });
  }

  recordDatabaseQuery(operation: string, table: string, duration: number, status: 'success' | 'error'): void {
    this.incrementCounter('database_queries_total', {
      operation,
      table,
      status,
    });
    
    this.observeHistogram('database_query_duration_seconds', duration, {
      operation,
      table,
    });
  }

  shutdown(): void {
    if (this.server) {
      this.server.close();
    }
  }
}