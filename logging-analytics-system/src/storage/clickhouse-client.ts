import { createClient, ClickHouseClient } from '@clickhouse/client';
import { Logger } from 'winston';

export interface LogEntry {
  timestamp: Date;
  level: string;
  message: string;
  service: string;
  host: string;
  environment: string;
  trace_id?: string;
  span_id?: string;
  user_id?: string;
  request_id?: string;
  metadata: Record<string, any>;
  sentry_event_id?: string;
  sentry_issue_id?: string;
}

export interface QueryOptions {
  startTime?: Date;
  endTime?: Date;
  service?: string;
  level?: string;
  environment?: string;
  limit?: number;
  searchText?: string;
  traceId?: string;
  sentryEventId?: string;
}

export class ClickHouseStorage {
  public client: ClickHouseClient;
  private logger: Logger;

  constructor(config: {
    host: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    logger: Logger;
  }) {
    this.logger = config.logger;
    
    this.client = createClient({
      host: `http://${config.host}:${config.port || 8123}`,
      database: config.database || 'logs',
      username: config.username || 'default',
      password: config.password || '',
      compression: {
        request: true,
        response: true,
      },
    });
  }

  async initialize(): Promise<void> {
    try {
      // Create database if not exists
      await this.client.exec({
        query: `CREATE DATABASE IF NOT EXISTS logs`,
      });

      // Create logs table with optimized schema
      await this.client.exec({
        query: `
          CREATE TABLE IF NOT EXISTS logs.entries (
            timestamp DateTime64(3),
            date Date DEFAULT toDate(timestamp),
            level LowCardinality(String),
            message String,
            service LowCardinality(String),
            host LowCardinality(String),
            environment LowCardinality(String),
            trace_id String,
            span_id String,
            user_id String,
            request_id String,
            metadata String, -- JSON string
            sentry_event_id String,
            sentry_issue_id String,
            INDEX idx_trace_id trace_id TYPE bloom_filter(0.01) GRANULARITY 1,
            INDEX idx_sentry_event sentry_event_id TYPE bloom_filter(0.01) GRANULARITY 1,
            INDEX idx_message message TYPE tokenbf_v1(32768, 3, 0) GRANULARITY 1
          )
          ENGINE = MergeTree()
          PARTITION BY toYYYYMM(date)
          ORDER BY (service, environment, level, timestamp)
          TTL date + INTERVAL 30 DAY
          SETTINGS index_granularity = 8192
        `,
      });

      // Create materialized view for metrics
      await this.client.exec({
        query: `
          CREATE MATERIALIZED VIEW IF NOT EXISTS logs.metrics_mv
          ENGINE = SummingMergeTree()
          PARTITION BY toYYYYMMDD(date)
          ORDER BY (date, hour, service, environment, level)
          AS SELECT
            toDate(timestamp) as date,
            toStartOfHour(timestamp) as hour,
            service,
            environment,
            level,
            count() as count
          FROM logs.entries
          GROUP BY date, hour, service, environment, level
        `,
      });

      this.logger.info('ClickHouse storage initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize ClickHouse storage', error);
      throw error;
    }
  }

  async insertLogs(logs: LogEntry[]): Promise<void> {
    if (logs.length === 0) return;

    const values = logs.map(log => ({
      timestamp: log.timestamp,
      level: log.level,
      message: log.message,
      service: log.service,
      host: log.host,
      environment: log.environment,
      trace_id: log.trace_id || '',
      span_id: log.span_id || '',
      user_id: log.user_id || '',
      request_id: log.request_id || '',
      metadata: JSON.stringify(log.metadata || {}),
      sentry_event_id: log.sentry_event_id || '',
      sentry_issue_id: log.sentry_issue_id || '',
    }));

    await this.client.insert({
      table: 'logs.entries',
      values,
      format: 'JSONEachRow',
    });
  }

  async queryLogs(options: QueryOptions): Promise<LogEntry[]> {
    const conditions: string[] = [];
    const params: Record<string, any> = {};

    if (options.startTime) {
      conditions.push('timestamp >= {startTime:DateTime64(3)}');
      params.startTime = options.startTime.toISOString();
    }

    if (options.endTime) {
      conditions.push('timestamp <= {endTime:DateTime64(3)}');
      params.endTime = options.endTime.toISOString();
    }

    if (options.service) {
      conditions.push('service = {service:String}');
      params.service = options.service;
    }

    if (options.level) {
      conditions.push('level = {level:String}');
      params.level = options.level;
    }

    if (options.environment) {
      conditions.push('environment = {environment:String}');
      params.environment = options.environment;
    }

    if (options.searchText) {
      conditions.push('message LIKE {searchText:String}');
      params.searchText = `%${options.searchText}%`;
    }

    if (options.traceId) {
      conditions.push('trace_id = {traceId:String}');
      params.traceId = options.traceId;
    }

    if (options.sentryEventId) {
      conditions.push('sentry_event_id = {sentryEventId:String}');
      params.sentryEventId = options.sentryEventId;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options.limit || 1000;

    const query = `
      SELECT 
        timestamp,
        level,
        message,
        service,
        host,
        environment,
        trace_id,
        span_id,
        user_id,
        request_id,
        metadata,
        sentry_event_id,
        sentry_issue_id
      FROM logs.entries
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `;

    const result = await this.client.query({
      query,
      format: 'JSONEachRow',
      query_params: params,
    });

    const rows = await result.json<any[]>();
    
    return rows.map(row => ({
      ...row,
      timestamp: new Date(row.timestamp),
      metadata: JSON.parse(row.metadata || '{}'),
    }));
  }

  async getMetrics(
    service?: string,
    environment?: string,
    startTime?: Date,
    endTime?: Date
  ): Promise<any[]> {
    const conditions: string[] = [];
    const params: Record<string, any> = {};

    if (service) {
      conditions.push('service = {service:String}');
      params.service = service;
    }

    if (environment) {
      conditions.push('environment = {environment:String}');
      params.environment = environment;
    }

    if (startTime) {
      conditions.push('hour >= {startTime:DateTime}');
      params.startTime = startTime.toISOString();
    }

    if (endTime) {
      conditions.push('hour <= {endTime:DateTime}');
      params.endTime = endTime.toISOString();
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        hour,
        service,
        environment,
        level,
        sum(count) as count
      FROM logs.metrics_mv
      ${whereClause}
      GROUP BY hour, service, environment, level
      ORDER BY hour DESC
    `;

    const result = await this.client.query({
      query,
      format: 'JSONEachRow',
      query_params: params,
    });

    return result.json();
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}