import * as promClient from 'prom-client';
import { Logger } from 'winston';
import { Request, Response, NextFunction } from 'express';

export interface MetricsConfig {
  prefix?: string;
  defaultLabels?: Record<string, string>;
  includeDefaults?: boolean;
  pushGatewayUrl?: string;
  pushInterval?: number;
}

export class MetricsCollector {
  private register: promClient.Registry;
  private logger: Logger;
  private config: MetricsConfig;
  private pushGateway?: promClient.Pushgateway;
  private pushInterval?: NodeJS.Timer;

  // Core metrics
  private httpRequestDuration: promClient.Histogram;
  private httpRequestTotal: promClient.Counter;
  private activeConnections: promClient.Gauge;
  private logEventsTotal: promClient.Counter;
  private logEventsSize: promClient.Histogram;
  private storageOperations: promClient.Counter;
  private storageLatency: promClient.Histogram;
  private sentryEventsTotal: promClient.Counter;
  private errorRate: promClient.Counter;

  constructor(config: MetricsConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.register = new promClient.Registry();

    // Set default labels
    if (config.defaultLabels) {
      this.register.setDefaultLabels(config.defaultLabels);
    }

    // Include default metrics (CPU, memory, etc.)
    if (config.includeDefaults !== false) {
      promClient.collectDefaultMetrics({
        register: this.register,
        prefix: config.prefix,
      });
    }

    // Initialize custom metrics
    this.initializeMetrics();

    // Setup push gateway if configured
    if (config.pushGatewayUrl) {
      this.setupPushGateway();
    }
  }

  private initializeMetrics(): void {
    const prefix = this.config.prefix || '';

    // HTTP metrics
    this.httpRequestDuration = new promClient.Histogram({
      name: `${prefix}http_request_duration_seconds`,
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code', 'service'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.register],
    });

    this.httpRequestTotal = new promClient.Counter({
      name: `${prefix}http_requests_total`,
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'service'],
      registers: [this.register],
    });

    this.activeConnections = new promClient.Gauge({
      name: `${prefix}active_connections`,
      help: 'Number of active connections',
      labelNames: ['service'],
      registers: [this.register],
    });

    // Log metrics
    this.logEventsTotal = new promClient.Counter({
      name: `${prefix}log_events_total`,
      help: 'Total number of log events',
      labelNames: ['level', 'service', 'environment'],
      registers: [this.register],
    });

    this.logEventsSize = new promClient.Histogram({
      name: `${prefix}log_event_size_bytes`,
      help: 'Size of log events in bytes',
      labelNames: ['service'],
      buckets: [100, 500, 1000, 5000, 10000, 50000, 100000],
      registers: [this.register],
    });

    // Storage metrics
    this.storageOperations = new promClient.Counter({
      name: `${prefix}storage_operations_total`,
      help: 'Total number of storage operations',
      labelNames: ['operation', 'status', 'storage_type'],
      registers: [this.register],
    });

    this.storageLatency = new promClient.Histogram({
      name: `${prefix}storage_operation_duration_seconds`,
      help: 'Duration of storage operations in seconds',
      labelNames: ['operation', 'storage_type'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.register],
    });

    // Sentry metrics
    this.sentryEventsTotal = new promClient.Counter({
      name: `${prefix}sentry_events_total`,
      help: 'Total number of Sentry events',
      labelNames: ['level', 'environment'],
      registers: [this.register],
    });

    // Error metrics
    this.errorRate = new promClient.Counter({
      name: `${prefix}errors_total`,
      help: 'Total number of errors',
      labelNames: ['type', 'service', 'operation'],
      registers: [this.register],
    });

    this.logger.info('Metrics collector initialized');
  }

  private setupPushGateway(): void {
    if (!this.config.pushGatewayUrl) return;

    this.pushGateway = new promClient.Pushgateway(
      this.config.pushGatewayUrl,
      {},
      this.register
    );

    // Setup periodic push
    const interval = this.config.pushInterval || 10000; // Default 10 seconds
    this.pushInterval = setInterval(async () => {
      try {
        await this.pushGateway!.pushAdd({ jobName: 'logging_analytics' });
      } catch (error) {
        this.logger.error('Failed to push metrics to gateway', error);
      }
    }, interval);

    this.logger.info(`Push gateway configured: ${this.config.pushGatewayUrl}`);
  }

  // Express middleware for automatic HTTP metrics
  httpMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      
      // Increment active connections
      this.activeConnections.inc({ service: 'api' });

      // Intercept response finish
      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const labels = {
          method: req.method,
          route: req.route?.path || req.path,
          status_code: res.statusCode.toString(),
          service: 'api',
        };

        this.httpRequestDuration.observe(labels, duration);
        this.httpRequestTotal.inc(labels);
        this.activeConnections.dec({ service: 'api' });
      });

      next();
    };
  }

  // Record log event
  recordLogEvent(level: string, service: string, environment: string, size: number): void {
    this.logEventsTotal.inc({ level, service, environment });
    this.logEventsSize.observe({ service }, size);
  }

  // Record storage operation
  recordStorageOperation(
    operation: string,
    duration: number,
    success: boolean,
    storageType: string = 'clickhouse'
  ): void {
    const status = success ? 'success' : 'failure';
    this.storageOperations.inc({ operation, status, storage_type: storageType });
    this.storageLatency.observe({ operation, storage_type: storageType }, duration);
  }

  // Record Sentry event
  recordSentryEvent(level: string, environment: string): void {
    this.sentryEventsTotal.inc({ level, environment });
  }

  // Record error
  recordError(type: string, service: string, operation: string): void {
    this.errorRate.inc({ type, service, operation });
  }

  // Get metrics for Prometheus scraping
  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  // Get metrics in JSON format
  async getMetricsJson(): Promise<promClient.Registry.MetricObject[]> {
    return this.register.getMetricsAsJSON();
  }

  // Create custom counter
  createCounter(
    name: string,
    help: string,
    labelNames?: string[]
  ): promClient.Counter {
    return new promClient.Counter({
      name: `${this.config.prefix || ''}${name}`,
      help,
      labelNames,
      registers: [this.register],
    });
  }

  // Create custom histogram
  createHistogram(
    name: string,
    help: string,
    labelNames?: string[],
    buckets?: number[]
  ): promClient.Histogram {
    return new promClient.Histogram({
      name: `${this.config.prefix || ''}${name}`,
      help,
      labelNames,
      buckets,
      registers: [this.register],
    });
  }

  // Create custom gauge
  createGauge(
    name: string,
    help: string,
    labelNames?: string[]
  ): promClient.Gauge {
    return new promClient.Gauge({
      name: `${this.config.prefix || ''}${name}`,
      help,
      labelNames,
      registers: [this.register],
    });
  }

  // Create custom summary
  createSummary(
    name: string,
    help: string,
    labelNames?: string[],
    percentiles?: number[]
  ): promClient.Summary {
    return new promClient.Summary({
      name: `${this.config.prefix || ''}${name}`,
      help,
      labelNames,
      percentiles,
      registers: [this.register],
    });
  }

  // Clean up resources
  async shutdown(): Promise<void> {
    if (this.pushInterval) {
      clearInterval(this.pushInterval);
    }

    if (this.pushGateway) {
      try {
        await this.pushGateway.delete({ jobName: 'logging_analytics' });
      } catch (error) {
        this.logger.error('Failed to delete metrics from push gateway', error);
      }
    }

    this.register.clear();
    this.logger.info('Metrics collector shut down');
  }
}

// Helper class for timing operations
export class MetricTimer {
  private start: number;

  constructor() {
    this.start = Date.now();
  }

  end(): number {
    return (Date.now() - this.start) / 1000;
  }
}