import { Pool, PoolClient } from "pg";
import { container } from "@sapphire/framework";
import type {
  TimescaleDBConfig,
  HealthCheckResult,
  Metric,
  MetricLabels,
  MetricsBackend,
} from "../types.js";

export class TimescaleDBBackend implements MetricsBackend {
  private pool: Pool;
  private schemaEnsured = false;
  private config: TimescaleDBConfig;

  constructor(config: TimescaleDBConfig) {
    this.config = config;
    this.pool = new Pool({
      connectionString: config.connectionString,
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl,
      max: config.maxConnections || 10,
      idleTimeoutMillis: config.idleTimeout || 30000,
      connectionTimeoutMillis: config.connectionTimeout || 2000,
    });
  }

  private async ensureSchema(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Enable TimescaleDB extension
      await client.query('CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE');
      
      // Create metrics table
      await client.query(`
        CREATE TABLE IF NOT EXISTS metrics (
          time TIMESTAMPTZ NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          help TEXT,
          labels JSONB DEFAULT '{}',
          value DOUBLE PRECISION NOT NULL,
          CONSTRAINT metrics_type_check CHECK (type IN ('counter', 'gauge', 'histogram', 'summary'))
        )
      `);

      // Create hypertable if it doesn't exist
      await client.query(`
        SELECT create_hypertable('metrics', 'time', if_not_exists => TRUE)
      `);

      // Create indexes for better query performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_metrics_name_time ON metrics (name, time DESC)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_metrics_type_time ON metrics (type, time DESC)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_metrics_labels ON metrics USING GIN (labels)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_metrics_name_labels_time ON metrics (name, labels, time DESC)
      `);

      // Set up retention and compression policies
      await this.ensureRetentionPolicies(client);

      container.logger.info('TimescaleDB metrics schema ensured');
    } catch (error) {
      container.logger.warn('Failed to ensure metrics schema:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async write(metrics: Metric[]): Promise<void> {
    if (metrics.length === 0) return;

    // Ensure schema is ready before first write
    if (!this.schemaEnsured) {
      try {
        await this.ensureSchema();
        this.schemaEnsured = true;
      } catch (error) {
        container.logger.warn('Failed to ensure metrics schema, continuing with write:', error);
        this.schemaEnsured = true; // Prevent repeated attempts
      }
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const metric of metrics) {
        for (const sample of metric.samples) {
          const timestamp = sample.timestamp;
          const labels = sample.labels;
          const value = sample.value; // All sample types now have 'value' property

          await client.query(
            `INSERT INTO metrics (time, name, type, help, labels, value) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [timestamp, metric.name, metric.type, metric.help, JSON.stringify(labels), value]
          );
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async query(
    name: string,
    labels?: MetricLabels,
    timeRange?: { start: Date; end: Date },
  ): Promise<Metric[]> {
    const client = await this.pool.connect();
    try {
      let query = 'SELECT * FROM metrics WHERE name = $1';
      const params: any[] = [name];

      if (labels) {
        for (const [key, value] of Object.entries(labels)) {
          params.push(JSON.stringify({ [key]: value }));
          query += ` AND labels @> $${params.length}`;
        }
      }

      if (timeRange) {
        params.push(timeRange.start, timeRange.end);
        query += ` AND time >= $${params.length - 1} AND time <= $${params.length}`;
      }

      query += ' ORDER BY time DESC LIMIT 10000';

      const result = await client.query(query, params);
      
      return this.deserializeRows(result.rows);
    } finally {
      client.release();
    }
  }

  private deserializeRows(rows: any[]): Metric[] {
    const metricsMap = new Map<string, Metric>();

    for (const row of rows) {
      const key = `${row.name}-${row.type}`;

      if (!metricsMap.has(key)) {
        metricsMap.set(key, {
          type: row.type,
          name: row.name,
          help: row.help,
          samples: [],
        } as Metric);
      }

      const metric = metricsMap.get(key)!;
      const labels = row.labels || {};

      const sample = {
        value: row.value || 0,
        timestamp: row.time,
        labels,
      };

      metric.samples.push(sample);
    }

    return Array.from(metricsMap.values());
  }

  async getCounterTotal(
    name: string,
    labels?: MetricLabels,
    timeRange?: { start: Date; end: Date },
  ): Promise<number> {
    const client = await this.pool.connect();
    try {
      // Get the latest (maximum) counter value for each label combination
      let query = `
        SELECT COALESCE(MAX(value), 0) as total 
        FROM metrics 
        WHERE name = $1 AND type = $2`;
      const params: any[] = [name, 'counter'];

      if (labels) {
        for (const [key, value] of Object.entries(labels)) {
          params.push(JSON.stringify({ [key]: value }));
          query += ` AND labels @> $${params.length}`;
        }
      }

      if (timeRange) {
        params.push(timeRange.start, timeRange.end);
        query += ` AND time >= $${params.length - 1} AND time <= $${params.length}`;
      }

      const result = await client.query(query, params);
      return parseFloat(result.rows[0]?.total || '0');
    } finally {
      client.release();
    }
  }

  async getCounterRate(
    name: string,
    labels?: MetricLabels,
    timeRange?: { start: Date; end: Date },
    interval: string = "1m",
  ): Promise<Array<{ timestamp: Date; rate: number }>> {
    const client = await this.pool.connect();
    try {
      // Calculate rate as the increase in counter value over time
      let query = `
        WITH bucketed_data AS (
          SELECT 
            time_bucket($1, time) as bucket,
            MAX(value) as max_value
          FROM metrics 
          WHERE name = $2 AND type = $3`;
      
      const params: any[] = [interval, name, 'counter'];

      if (labels) {
        for (const [key, value] of Object.entries(labels)) {
          params.push(JSON.stringify({ [key]: value }));
          query += ` AND labels @> $${params.length}`;
        }
      }

      if (timeRange) {
        params.push(timeRange.start, timeRange.end);
        query += ` AND time >= $${params.length - 1} AND time <= $${params.length}`;
      }

      query += `
          GROUP BY bucket
        )
        SELECT 
          bucket as timestamp,
          COALESCE(max_value - LAG(max_value) OVER (ORDER BY bucket), 0) / EXTRACT(EPOCH FROM INTERVAL $1) as rate
        FROM bucketed_data
        ORDER BY bucket`;

      const result = await client.query(query, params);
      
      return result.rows.map(row => ({
        timestamp: row.timestamp,
        rate: parseFloat(row.rate || '0'),
      }));
    } finally {
      client.release();
    }
  }

  async getHistogramStats(
    name: string,
    labels?: MetricLabels,
    timeRange?: { start: Date; end: Date },
  ): Promise<{
    count: number;
    sum: number;
    min: number;
    max: number;
    avg: number;
  }> {
    const client = await this.pool.connect();
    try {
      let query = `
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(value), 0) as sum,
          COALESCE(MIN(value), 0) as min,
          COALESCE(MAX(value), 0) as max,
          COALESCE(AVG(value), 0) as avg
        FROM metrics 
        WHERE name = $1 AND type = $2`;
      
      const params: any[] = [name, 'histogram'];

      if (labels) {
        for (const [key, value] of Object.entries(labels)) {
          params.push(JSON.stringify({ [key]: value }));
          query += ` AND labels @> $${params.length}`;
        }
      }

      if (timeRange) {
        params.push(timeRange.start, timeRange.end);
        query += ` AND time >= $${params.length - 1} AND time <= $${params.length}`;
      }

      const result = await client.query(query, params);
      const row = result.rows[0];
      
      return {
        count: parseInt(row.count || '0'),
        sum: parseFloat(row.sum || '0'),
        min: parseFloat(row.min || '0'),
        max: parseFloat(row.max || '0'),
        avg: parseFloat(row.avg || '0'),
      };
    } finally {
      client.release();
    }
  }

  async getHistogramPercentiles(
    name: string,
    percentiles: number[] = [50, 90, 95, 99],
    labels?: MetricLabels,
    timeRange?: { start: Date; end: Date },
  ): Promise<Record<number, number>> {
    const client = await this.pool.connect();
    try {
      const percentileQueries = percentiles.map((p, i) => 
        `percentile_cont(${p / 100.0}) WITHIN GROUP (ORDER BY value) as p${p}`
      ).join(', ');

      let query = `SELECT ${percentileQueries} FROM metrics WHERE name = $1 AND type = $2`;
      const params: any[] = [name, 'histogram'];

      if (labels) {
        for (const [key, value] of Object.entries(labels)) {
          params.push(JSON.stringify({ [key]: value }));
          query += ` AND labels @> $${params.length}`;
        }
      }

      if (timeRange) {
        params.push(timeRange.start, timeRange.end);
        query += ` AND time >= $${params.length - 1} AND time <= $${params.length}`;
      }

      const result = await client.query(query, params);
      const row = result.rows[0];
      
      const results: Record<number, number> = {};
      for (const p of percentiles) {
        results[p] = parseFloat(row[`p${p}`] || '0');
      }
      
      return results;
    } finally {
      client.release();
    }
  }

  async getHistogramBuckets(
    name: string,
    buckets: number[],
    labels?: MetricLabels,
    timeRange?: { start: Date; end: Date },
  ): Promise<Array<{ le: number; count: number }>> {
    const client = await this.pool.connect();
    try {
      const bucketCases = buckets.map((bucket, i) => {
        if (bucket === Infinity) {
          return `COUNT(*) as bucket_${i}`;
        }
        return `COUNT(CASE WHEN value <= ${bucket} THEN 1 END) as bucket_${i}`;
      }).join(', ');

      let query = `SELECT ${bucketCases} FROM metrics WHERE name = $1 AND type = $2`;
      const params: any[] = [name, 'histogram'];

      if (labels) {
        for (const [key, value] of Object.entries(labels)) {
          params.push(JSON.stringify({ [key]: value }));
          query += ` AND labels @> $${params.length}`;
        }
      }

      if (timeRange) {
        params.push(timeRange.start, timeRange.end);
        query += ` AND time >= $${params.length - 1} AND time <= $${params.length}`;
      }

      const result = await client.query(query, params);
      const row = result.rows[0];
      
      return buckets.map((bucket, i) => ({
        le: bucket,
        count: parseInt(row[`bucket_${i}`] || '0'),
      }));
    } finally {
      client.release();
    }
  }

  async getGaugeTimeSeries(
    name: string,
    labels?: MetricLabels,
    timeRange?: { start: Date; end: Date },
    interval: string = "1m",
  ): Promise<
    Array<{
      timestamp: Date;
      value: number;
      min: number;
      max: number;
      avg: number;
    }>
  > {
    const client = await this.pool.connect();
    try {
      let query = `
        SELECT 
          time_bucket($1, time) as bucket,
          last(value, time) as value,
          MIN(value) as min,
          MAX(value) as max,
          AVG(value) as avg
        FROM metrics 
        WHERE name = $2 AND type = $3`;
      
      const params: any[] = [interval, name, 'gauge'];

      if (labels) {
        for (const [key, value] of Object.entries(labels)) {
          params.push(JSON.stringify({ [key]: value }));
          query += ` AND labels @> $${params.length}`;
        }
      }

      if (timeRange) {
        params.push(timeRange.start, timeRange.end);
        query += ` AND time >= $${params.length - 1} AND time <= $${params.length}`;
      }

      query += ' GROUP BY bucket ORDER BY bucket';

      const result = await client.query(query, params);
      
      return result.rows.map(row => ({
        timestamp: row.bucket,
        value: parseFloat(row.value || '0'),
        min: parseFloat(row.min || '0'),
        max: parseFloat(row.max || '0'),
        avg: parseFloat(row.avg || '0'),
      }));
    } finally {
      client.release();
    }
  }

  async getGaugeCurrentValues(
    name: string,
    labels?: MetricLabels,
  ): Promise<Array<{ labels: MetricLabels; value: number; timestamp: Date }>> {
    const client = await this.pool.connect();
    try {
      let query = `
        SELECT DISTINCT ON (labels) 
          labels, value, time 
        FROM metrics 
        WHERE name = $1 AND type = $2`;
      
      const params: any[] = [name, 'gauge'];

      if (labels) {
        for (const [key, value] of Object.entries(labels)) {
          params.push(JSON.stringify({ [key]: value }));
          query += ` AND labels @> $${params.length}`;
        }
      }

      query += ' ORDER BY labels, time DESC';

      const result = await client.query(query, params);
      
      return result.rows.map(row => ({
        labels: row.labels || {},
        value: parseFloat(row.value || '0'),
        timestamp: row.time,
      }));
    } finally {
      client.release();
    }
  }

  async getSummaryStats(
    name: string,
    labels?: MetricLabels,
    timeRange?: { start: Date; end: Date },
  ): Promise<{
    count: number;
    sum: number;
    min: number;
    max: number;
    avg: number;
  }> {
    const client = await this.pool.connect();
    try {
      let query = `
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(value), 0) as sum,
          COALESCE(MIN(value), 0) as min,
          COALESCE(MAX(value), 0) as max,
          COALESCE(AVG(value), 0) as avg
        FROM metrics 
        WHERE name = $1 AND type = $2`;
      
      const params: any[] = [name, 'summary'];

      if (labels) {
        for (const [key, value] of Object.entries(labels)) {
          params.push(JSON.stringify({ [key]: value }));
          query += ` AND labels @> $${params.length}`;
        }
      }

      if (timeRange) {
        params.push(timeRange.start, timeRange.end);
        query += ` AND time >= $${params.length - 1} AND time <= $${params.length}`;
      }

      const result = await client.query(query, params);
      const row = result.rows[0];
      
      return {
        count: parseInt(row.count || '0'),
        sum: parseFloat(row.sum || '0'),
        min: parseFloat(row.min || '0'),
        max: parseFloat(row.max || '0'),
        avg: parseFloat(row.avg || '0'),
      };
    } finally {
      client.release();
    }
  }

  async getSummaryQuantiles(
    name: string,
    quantiles: number[] = [0.5, 0.9, 0.95, 0.99],
    labels?: MetricLabels,
    timeRange?: { start: Date; end: Date },
  ): Promise<Record<number, number>> {
    const client = await this.pool.connect();
    try {
      const quantileQueries = quantiles.map((q, i) => 
        `percentile_cont(${q}) WITHIN GROUP (ORDER BY value) as q${q.toString().replace('.', '_')}`
      ).join(', ');

      let query = `SELECT ${quantileQueries} FROM metrics WHERE name = $1 AND type = $2`;
      const params: any[] = [name, 'summary'];

      if (labels) {
        for (const [key, value] of Object.entries(labels)) {
          params.push(JSON.stringify({ [key]: value }));
          query += ` AND labels @> $${params.length}`;
        }
      }

      if (timeRange) {
        params.push(timeRange.start, timeRange.end);
        query += ` AND time >= $${params.length - 1} AND time <= $${params.length}`;
      }

      const result = await client.query(query, params);
      const row = result.rows[0];
      
      const results: Record<number, number> = {};
      for (const q of quantiles) {
        const key = `q${q.toString().replace('.', '_')}`;
        results[q] = parseFloat(row[key] || '0');
      }
      
      return results;
    } finally {
      client.release();
    }
  }

  async getSummaryTimeSeries(
    name: string,
    labels?: MetricLabels,
    timeRange?: { start: Date; end: Date },
    interval: string = "1m",
    quantiles: number[] = [0.5, 0.9, 0.95, 0.99],
  ): Promise<
    Array<{
      timestamp: Date;
      count: number;
      avg: number;
      quantiles: Record<number, number>;
    }>
  > {
    const client = await this.pool.connect();
    try {
      const quantileQueries = quantiles.map((q, i) => 
        `percentile_cont(${q}) WITHIN GROUP (ORDER BY value) as q${q.toString().replace('.', '_')}`
      ).join(', ');

      let query = `
        SELECT 
          time_bucket($1, time) as bucket,
          COUNT(*) as count,
          AVG(value) as avg,
          ${quantileQueries}
        FROM metrics 
        WHERE name = $2 AND type = $3`;
      
      const params: any[] = [interval, name, 'summary'];

      if (labels) {
        for (const [key, value] of Object.entries(labels)) {
          params.push(JSON.stringify({ [key]: value }));
          query += ` AND labels @> $${params.length}`;
        }
      }

      if (timeRange) {
        params.push(timeRange.start, timeRange.end);
        query += ` AND time >= $${params.length - 1} AND time <= $${params.length}`;
      }

      query += ' GROUP BY bucket ORDER BY bucket';

      const result = await client.query(query, params);
      
      return result.rows.map(row => {
        const quantileResults: Record<number, number> = {};
        for (const q of quantiles) {
          const key = `q${q.toString().replace('.', '_')}`;
          quantileResults[q] = parseFloat(row[key] || '0');
        }

        return {
          timestamp: row.bucket,
          count: parseInt(row.count || '0'),
          avg: parseFloat(row.avg || '0'),
          quantiles: quantileResults,
        };
      });
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const client = await this.pool.connect();
      try {
        await client.query('SELECT NOW()');
        const versionResult = await client.query('SELECT version()');
        const timescaleResult = await client.query("SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'");
        
        return {
          healthy: true,
          info: {
            database: 'PostgreSQL',
            version: versionResult.rows[0]?.version,
            timescale_version: timescaleResult.rows[0]?.extversion,
            pool_total: this.pool.totalCount,
            pool_idle: this.pool.idleCount,
            pool_waiting: this.pool.waitingCount,
          },
        };
      } finally {
        client.release();
      }
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async ensureRetentionPolicies(client: any): Promise<void> {
    try {
      const metricsRetentionDays = this.config.metricsRetentionDays || 730; // 2 years default
      const metricsCompressionDays = this.config.metricsCompressionDays || 30; // 30 days default

      // Try to add retention policy - if it already exists, it will be ignored
      try {
        await client.query(`
          SELECT add_retention_policy('metrics', INTERVAL '${metricsRetentionDays} days', if_not_exists => TRUE)
        `);
        container.logger.info(`Ensured metrics retention policy: ${metricsRetentionDays} days`);
      } catch (retentionError: any) {
        // Log but don't fail if retention policy setup fails
        container.logger.debug('Retention policy setup skipped:', retentionError.message);
      }

      // Try to add compression policy - set up compression first, then add policy
      try {
        // Enable compression on the hypertable first (idempotent)
        await client.query(`
          ALTER TABLE metrics SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'name, labels'
          )
        `);

        await client.query(`
          SELECT add_compression_policy('metrics', INTERVAL '${metricsCompressionDays} days', if_not_exists => TRUE)
        `);
        container.logger.info(`Ensured metrics compression policy: ${metricsCompressionDays} days`);
      } catch (compressionError: any) {
        // Log but don't fail if compression policy setup fails
        container.logger.debug('Compression policy setup skipped:', compressionError.message);
      }

    } catch (error) {
      // Don't fail schema creation if policies fail
      container.logger.warn('Failed to set up retention policies:', error);
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}