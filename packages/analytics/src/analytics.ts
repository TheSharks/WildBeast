import { ClickHouseClient, createClient } from '@clickhouse/client';
import * as Sentry from '@sentry/node';
import { Queue } from 'bullmq';
import { Client, GatewayIntentBits } from 'discord.js';
import { EventEmitter } from 'events';
import { MetricsCollector } from './metrics.js';
import { EventTracker } from './events.js';

export interface AnalyticsConfig {
  clickhouse: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  sentry: {
    dsn: string;
    environment: string;
    release?: string;
  };
  prometheus: {
    port: number;
    path: string;
  };
}

export interface LogEvent {
  timestamp: Date;
  level: string;
  message: string;
  metadata?: Record<string, any>;
  source: string;
  trace_id?: string;
  span_id?: string;
  user_id?: string;
  guild_id?: string;
  channel_id?: string;
  command?: string;
  error?: Error;
}

export interface MetricEvent {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: Date;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
}

export interface AnalyticsEvent {
  event_type: string;
  user_id?: string;
  guild_id?: string;
  channel_id?: string;
  properties: Record<string, any>;
  timestamp: Date;
  session_id?: string;
}

export class AnalyticsService extends EventEmitter {
  private clickhouse: ClickHouseClient;
  private metricsCollector: MetricsCollector;
  private eventTracker: EventTracker;
  private analyticsQueue: Queue;
  private config: AnalyticsConfig;
  private isInitialized = false;

  constructor(config: AnalyticsConfig) {
    super();
    this.config = config;
    
    // Initialize ClickHouse client
    this.clickhouse = createClient({
      host: `http://${config.clickhouse.host}:${config.clickhouse.port}`,
      username: config.clickhouse.username,
      password: config.clickhouse.password,
      database: config.clickhouse.database,
      clickhouse_settings: {
        async_insert: 1,
        wait_for_async_insert: 0,
      },
    });

    // Initialize metrics collector
    this.metricsCollector = new MetricsCollector(config.prometheus);
    
    // Initialize event tracker
    this.eventTracker = new EventTracker();
    
    // Initialize analytics queue for async processing
    this.analyticsQueue = new Queue('analytics-processing', {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      // Initialize Sentry
      Sentry.init({
        dsn: this.config.sentry.dsn,
        environment: this.config.sentry.environment,
        release: this.config.sentry.release,
        integrations: [
          new Sentry.Integrations.Http({ tracing: true }),
          new Sentry.Integrations.OnUncaughtException(),
          new Sentry.Integrations.OnUnhandledRejection(),
        ],
        tracesSampleRate: 0.1,
        profilesSampleRate: 0.1,
      });

      // Create ClickHouse tables
      await this.createTables();
      
      // Initialize metrics collector
      await this.metricsCollector.initialize();
      
      // Start processing analytics queue
      this.setupQueueProcessing();
      
      this.isInitialized = true;
      this.emit('initialized');
      
    } catch (error) {
      console.error('Failed to initialize analytics service:', error);
      Sentry.captureException(error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    const queries = [
      // Logs table
      `CREATE TABLE IF NOT EXISTS logs (
        timestamp DateTime64(3),
        level LowCardinality(String),
        message String,
        metadata String,
        source LowCardinality(String),
        trace_id String,
        span_id String,
        user_id String,
        guild_id String,
        channel_id String,
        command String,
        error String
      ) ENGINE = MergeTree()
      ORDER BY timestamp
      PARTITION BY toYYYYMM(timestamp)
      TTL timestamp + INTERVAL 90 DAY`,

      // Metrics table
      `CREATE TABLE IF NOT EXISTS metrics (
        timestamp DateTime64(3),
        name LowCardinality(String),
        value Float64,
        labels String,
        type LowCardinality(String)
      ) ENGINE = MergeTree()
      ORDER BY (name, timestamp)
      PARTITION BY toYYYYMM(timestamp)
      TTL timestamp + INTERVAL 30 DAY`,

      // Events table
      `CREATE TABLE IF NOT EXISTS events (
        timestamp DateTime64(3),
        event_type LowCardinality(String),
        user_id String,
        guild_id String,
        channel_id String,
        properties String,
        session_id String
      ) ENGINE = MergeTree()
      ORDER BY (event_type, timestamp)
      PARTITION BY toYYYYMM(timestamp)
      TTL timestamp + INTERVAL 180 DAY`,

      // Performance table
      `CREATE TABLE IF NOT EXISTS performance (
        timestamp DateTime64(3),
        operation LowCardinality(String),
        duration Float64,
        status LowCardinality(String),
        metadata String
      ) ENGINE = MergeTree()
      ORDER BY timestamp
      PARTITION BY toYYYYMM(timestamp)
      TTL timestamp + INTERVAL 30 DAY`,
    ];

    for (const query of queries) {
      await this.clickhouse.exec({ query });
    }
  }

  private setupQueueProcessing(): void {
    this.analyticsQueue.process('log-batch', async (job) => {
      const logs: LogEvent[] = job.data.logs;
      await this.insertLogs(logs);
    });

    this.analyticsQueue.process('metric-batch', async (job) => {
      const metrics: MetricEvent[] = job.data.metrics;
      await this.insertMetrics(metrics);
    });

    this.analyticsQueue.process('event-batch', async (job) => {
      const events: AnalyticsEvent[] = job.data.events;
      await this.insertEvents(events);
    });
  }

  async log(event: LogEvent): Promise<void> {
    try {
      // Add to Sentry breadcrumb
      Sentry.addBreadcrumb({
        category: 'log',
        level: event.level as any,
        message: event.message,
        data: event.metadata,
      });

      // If it's an error, capture it in Sentry
      if (event.error) {
        Sentry.captureException(event.error, {
          tags: {
            source: event.source,
            guild_id: event.guild_id,
            user_id: event.user_id,
            command: event.command,
          },
        });
      }

      // Queue for batch processing
      await this.analyticsQueue.add('log-batch', { logs: [event] });
      
    } catch (error) {
      console.error('Failed to log event:', error);
    }
  }

  async metric(event: MetricEvent): Promise<void> {
    try {
      // Update Prometheus metrics
      this.metricsCollector.recordMetric(event);
      
      // Queue for batch processing
      await this.analyticsQueue.add('metric-batch', { metrics: [event] });
      
    } catch (error) {
      console.error('Failed to record metric:', error);
    }
  }

  async track(event: AnalyticsEvent): Promise<void> {
    try {
      // Add to event tracker
      this.eventTracker.track(event);
      
      // Queue for batch processing
      await this.analyticsQueue.add('event-batch', { events: [event] });
      
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }

  private async insertLogs(logs: LogEvent[]): Promise<void> {
    const data = logs.map(log => ({
      timestamp: log.timestamp.toISOString(),
      level: log.level,
      message: log.message,
      metadata: JSON.stringify(log.metadata || {}),
      source: log.source,
      trace_id: log.trace_id || '',
      span_id: log.span_id || '',
      user_id: log.user_id || '',
      guild_id: log.guild_id || '',
      channel_id: log.channel_id || '',
      command: log.command || '',
      error: log.error ? JSON.stringify({
        name: log.error.name,
        message: log.error.message,
        stack: log.error.stack,
      }) : '',
    }));

    await this.clickhouse.insert({
      table: 'logs',
      values: data,
      format: 'JSONEachRow',
    });
  }

  private async insertMetrics(metrics: MetricEvent[]): Promise<void> {
    const data = metrics.map(metric => ({
      timestamp: metric.timestamp.toISOString(),
      name: metric.name,
      value: metric.value,
      labels: JSON.stringify(metric.labels || {}),
      type: metric.type,
    }));

    await this.clickhouse.insert({
      table: 'metrics',
      values: data,
      format: 'JSONEachRow',
    });
  }

  private async insertEvents(events: AnalyticsEvent[]): Promise<void> {
    const data = events.map(event => ({
      timestamp: event.timestamp.toISOString(),
      event_type: event.event_type,
      user_id: event.user_id || '',
      guild_id: event.guild_id || '',
      channel_id: event.channel_id || '',
      properties: JSON.stringify(event.properties),
      session_id: event.session_id || '',
    }));

    await this.clickhouse.insert({
      table: 'events',
      values: data,
      format: 'JSONEachRow',
    });
  }

  // Advanced analytics queries
  async getUserActivity(userId: string, days: number = 30): Promise<any[]> {
    const query = `
      SELECT 
        toDate(timestamp) as date,
        event_type,
        count() as count
      FROM events 
      WHERE user_id = {userId:String} 
        AND timestamp >= now() - INTERVAL {days:UInt32} DAY
      GROUP BY date, event_type
      ORDER BY date DESC
    `;

    const result = await this.clickhouse.query({
      query,
      query_params: { userId, days },
    });

    return result.json();
  }

  async getGuildStats(guildId: string, days: number = 30): Promise<any[]> {
    const query = `
      SELECT 
        toDate(timestamp) as date,
        event_type,
        count() as count,
        uniq(user_id) as unique_users
      FROM events 
      WHERE guild_id = {guildId:String} 
        AND timestamp >= now() - INTERVAL {days:UInt32} DAY
      GROUP BY date, event_type
      ORDER BY date DESC
    `;

    const result = await this.clickhouse.query({
      query,
      query_params: { guildId, days },
    });

    return result.json();
  }

  async getErrorRate(hours: number = 24): Promise<any[]> {
    const query = `
      SELECT 
        toStartOfHour(timestamp) as hour,
        level,
        count() as count
      FROM logs 
      WHERE timestamp >= now() - INTERVAL {hours:UInt32} HOUR
        AND level IN ('error', 'fatal', 'warn')
      GROUP BY hour, level
      ORDER BY hour DESC
    `;

    const result = await this.clickhouse.query({
      query,
      query_params: { hours },
    });

    return result.json();
  }

  async getPerformanceMetrics(operation?: string, hours: number = 24): Promise<any[]> {
    const query = `
      SELECT 
        toStartOfHour(timestamp) as hour,
        operation,
        avg(duration) as avg_duration,
        quantile(0.95)(duration) as p95_duration,
        quantile(0.99)(duration) as p99_duration,
        count() as count
      FROM performance 
      WHERE timestamp >= now() - INTERVAL {hours:UInt32} HOUR
        ${operation ? 'AND operation = {operation:String}' : ''}
      GROUP BY hour, operation
      ORDER BY hour DESC
    `;

    const result = await this.clickhouse.query({
      query,
      query_params: { hours, ...(operation && { operation }) },
    });

    return result.json();
  }

  async shutdown(): Promise<void> {
    await this.analyticsQueue.close();
    await this.clickhouse.close();
    this.metricsCollector.shutdown();
  }
}