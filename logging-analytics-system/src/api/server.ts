import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import winston from 'winston';
import dotenv from 'dotenv';
import { ClickHouseStorage, QueryOptions } from '../storage/clickhouse-client';
import { SentryIntegration, SentryWebhookHandler } from '../collectors/sentry-integration';
import { MetricsCollector } from '../collectors/metrics-collector';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

class LoggingAnalyticsAPI {
  private app: Application;
  private storage: ClickHouseStorage;
  private sentryIntegration: SentryIntegration;
  private sentryWebhookHandler: SentryWebhookHandler;
  private metricsCollector: MetricsCollector;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3000', 10);

    // Initialize storage
    this.storage = new ClickHouseStorage({
      host: process.env.CLICKHOUSE_HOST || 'localhost',
      port: parseInt(process.env.CLICKHOUSE_PORT || '8123', 10),
      database: process.env.CLICKHOUSE_DATABASE || 'logs',
      username: process.env.CLICKHOUSE_USER,
      password: process.env.CLICKHOUSE_PASSWORD,
      logger,
    });

    // Initialize metrics collector
    this.metricsCollector = new MetricsCollector({
      prefix: 'logging_analytics_',
      defaultLabels: {
        service: 'api',
        environment: process.env.NODE_ENV || 'development',
      },
      pushGatewayUrl: process.env.PROMETHEUS_PUSHGATEWAY_URL,
    }, logger);

    // Initialize Sentry integration
    this.sentryIntegration = new SentryIntegration({
      dsn: process.env.SENTRY_DSN || '',
      environment: process.env.NODE_ENV || 'development',
      serverName: process.env.SERVER_NAME,
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    }, logger, this.storage);

    this.sentryWebhookHandler = new SentryWebhookHandler(this.storage, logger);

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());

    // CORS
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN?.split(',') || '*',
      credentials: true,
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Metrics middleware
    this.app.use(this.metricsCollector.httpMiddleware());

    // Request logging
    this.app.use((req, res, next) => {
      logger.info('Request received', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // Logs API
    this.app.post('/api/logs/ingest', this.handleLogIngestion.bind(this));
    this.app.post('/api/logs/query', this.handleLogQuery.bind(this));
    this.app.get('/api/logs/stream', this.handleLogStream.bind(this));

    // Metrics API
    this.app.get('/metrics', this.handleMetrics.bind(this));
    this.app.get('/api/metrics/json', this.handleMetricsJson.bind(this));
    this.app.get('/api/metrics/logs', this.handleLogMetrics.bind(this));

    // Sentry integration
    this.app.post('/api/sentry/webhook', this.handleSentryWebhook.bind(this));
    this.app.post('/api/sentry/event', this.handleSentryEvent.bind(this));

    // Analytics API
    this.app.post('/api/analytics/aggregate', this.handleAnalyticsAggregate.bind(this));
    this.app.get('/api/analytics/services', this.handleGetServices.bind(this));
    this.app.get('/api/analytics/environments', this.handleGetEnvironments.bind(this));

    // Error handling
    this.app.use((err: Error, req: Request, res: Response, next: any) => {
      logger.error('Unhandled error', err);
      this.metricsCollector.recordError('unhandled', 'api', req.path);
      
      this.sentryIntegration.captureException(err, {
        tags: {
          path: req.path,
          method: req.method,
        },
        extra: {
          body: req.body,
          query: req.query,
        },
      });

      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
      });
    });
  }

  private async handleLogIngestion(req: Request, res: Response): Promise<void> {
    try {
      const logs = Array.isArray(req.body) ? req.body : [req.body];
      
      // Validate and transform logs
      const transformedLogs = logs.map(log => ({
        timestamp: new Date(log.timestamp || Date.now()),
        level: log.level || 'info',
        message: log.message || '',
        service: log.service || 'unknown',
        host: log.host || req.hostname,
        environment: log.environment || process.env.NODE_ENV || 'unknown',
        trace_id: log.trace_id,
        span_id: log.span_id,
        user_id: log.user_id,
        request_id: log.request_id,
        metadata: log.metadata || {},
        sentry_event_id: log.sentry_event_id,
        sentry_issue_id: log.sentry_issue_id,
      }));

      // Store logs
      await this.storage.insertLogs(transformedLogs);

      // Update metrics
      transformedLogs.forEach(log => {
        const size = JSON.stringify(log).length;
        this.metricsCollector.recordLogEvent(log.level, log.service, log.environment, size);
      });

      res.status(202).json({ 
        status: 'accepted', 
        count: transformedLogs.length 
      });
    } catch (error) {
      logger.error('Log ingestion failed', error);
      this.metricsCollector.recordError('ingestion', 'api', 'logs');
      res.status(500).json({ error: 'Failed to ingest logs' });
    }
  }

  private async handleLogQuery(req: Request, res: Response): Promise<void> {
    try {
      const options: QueryOptions = {
        startTime: req.body.startTime ? new Date(req.body.startTime) : undefined,
        endTime: req.body.endTime ? new Date(req.body.endTime) : undefined,
        service: req.body.service,
        level: req.body.level,
        environment: req.body.environment,
        limit: req.body.limit || 1000,
        searchText: req.body.searchText,
        traceId: req.body.traceId,
        sentryEventId: req.body.sentryEventId,
      };

      const logs = await this.storage.queryLogs(options);
      
      res.json({
        logs,
        count: logs.length,
        query: options,
      });
    } catch (error) {
      logger.error('Log query failed', error);
      this.metricsCollector.recordError('query', 'api', 'logs');
      res.status(500).json({ error: 'Failed to query logs' });
    }
  }

  private async handleLogStream(req: Request, res: Response): Promise<void> {
    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const options: QueryOptions = {
      service: req.query.service as string,
      level: req.query.level as string,
      environment: req.query.environment as string,
      limit: 100,
    };

    // Poll for new logs every 2 seconds
    const interval = setInterval(async () => {
      try {
        const logs = await this.storage.queryLogs({
          ...options,
          startTime: new Date(Date.now() - 5000), // Last 5 seconds
        });

        if (logs.length > 0) {
          res.write(`data: ${JSON.stringify(logs)}\n\n`);
        }
      } catch (error) {
        logger.error('Log streaming failed', error);
      }
    }, 2000);

    // Clean up on disconnect
    req.on('close', () => {
      clearInterval(interval);
    });
  }

  private async handleMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.metricsCollector.getMetrics();
      res.set('Content-Type', 'text/plain');
      res.send(metrics);
    } catch (error) {
      logger.error('Metrics retrieval failed', error);
      res.status(500).json({ error: 'Failed to retrieve metrics' });
    }
  }

  private async handleMetricsJson(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.metricsCollector.getMetricsJson();
      res.json(metrics);
    } catch (error) {
      logger.error('Metrics JSON retrieval failed', error);
      res.status(500).json({ error: 'Failed to retrieve metrics' });
    }
  }

  private async handleLogMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.storage.getMetrics(
        req.query.service as string,
        req.query.environment as string,
        req.query.startTime ? new Date(req.query.startTime as string) : undefined,
        req.query.endTime ? new Date(req.query.endTime as string) : undefined
      );

      res.json(metrics);
    } catch (error) {
      logger.error('Log metrics retrieval failed', error);
      res.status(500).json({ error: 'Failed to retrieve log metrics' });
    }
  }

  private async handleSentryWebhook(req: Request, res: Response): Promise<void> {
    try {
      // Verify Sentry webhook signature if configured
      const signature = req.headers['sentry-hook-signature'];
      if (process.env.SENTRY_WEBHOOK_SECRET && !this.verifySentrySignature(req.body, signature as string)) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      await this.sentryWebhookHandler.handleWebhook(req.body);
      res.status(200).json({ status: 'processed' });
    } catch (error) {
      logger.error('Sentry webhook processing failed', error);
      res.status(500).json({ error: 'Failed to process webhook' });
    }
  }

  private async handleSentryEvent(req: Request, res: Response): Promise<void> {
    try {
      const { message, level, tags, extra, user } = req.body;
      
      const eventId = this.sentryIntegration.captureEvent(
        message,
        level || 'info',
        extra,
        tags
      );

      if (user) {
        this.sentryIntegration.withScope((scope) => {
          scope.setUser(user);
        });
      }

      this.metricsCollector.recordSentryEvent(level || 'info', process.env.NODE_ENV || 'unknown');

      res.json({ eventId, status: 'sent' });
    } catch (error) {
      logger.error('Sentry event capture failed', error);
      res.status(500).json({ error: 'Failed to capture event' });
    }
  }

  private async handleAnalyticsAggregate(req: Request, res: Response): Promise<void> {
    try {
      const { groupBy, aggregation, filters, timeRange } = req.body;
      
      // Build dynamic query based on aggregation request
      let query = `
        SELECT 
          ${groupBy.map((field: string) => field).join(', ')},
          ${aggregation.function}(${aggregation.field}) as value
        FROM logs.entries
        WHERE 1=1
      `;

      // Add filters
      const params: Record<string, any> = {};
      let paramIndex = 0;

      if (timeRange?.start) {
        query += ` AND timestamp >= {start:DateTime64(3)}`;
        params.start = new Date(timeRange.start).toISOString();
      }

      if (timeRange?.end) {
        query += ` AND timestamp <= {end:DateTime64(3)}`;
        params.end = new Date(timeRange.end).toISOString();
      }

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          const paramName = `param${paramIndex++}`;
          query += ` AND ${key} = {${paramName}:String}`;
          params[paramName] = value;
        });
      }

      query += ` GROUP BY ${groupBy.join(', ')} ORDER BY value DESC LIMIT 100`;

      const result = await this.storage.client.query({
        query,
        format: 'JSONEachRow',
        query_params: params,
      });

      const data = await result.json();
      res.json(data);
    } catch (error) {
      logger.error('Analytics aggregation failed', error);
      res.status(500).json({ error: 'Failed to perform aggregation' });
    }
  }

  private async handleGetServices(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.storage.client.query({
        query: 'SELECT DISTINCT service FROM logs.entries ORDER BY service',
        format: 'JSONEachRow',
      });

      const services = await result.json();
      res.json(services.map((row: any) => row.service));
    } catch (error) {
      logger.error('Failed to get services', error);
      res.status(500).json({ error: 'Failed to retrieve services' });
    }
  }

  private async handleGetEnvironments(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.storage.client.query({
        query: 'SELECT DISTINCT environment FROM logs.entries ORDER BY environment',
        format: 'JSONEachRow',
      });

      const environments = await result.json();
      res.json(environments.map((row: any) => row.environment));
    } catch (error) {
      logger.error('Failed to get environments', error);
      res.status(500).json({ error: 'Failed to retrieve environments' });
    }
  }

  private verifySentrySignature(payload: any, signature: string): boolean {
    // Implement Sentry webhook signature verification
    // This is a placeholder - implement actual verification based on Sentry's documentation
    return true;
  }

  async start(): Promise<void> {
    try {
      // Initialize storage
      await this.storage.initialize();

      // Initialize Sentry
      if (process.env.SENTRY_DSN) {
        this.sentryIntegration.initialize();
      }

      // Start server
      this.app.listen(this.port, () => {
        logger.info(`Server started on port ${this.port}`);
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`ClickHouse: ${process.env.CLICKHOUSE_HOST || 'localhost'}:${process.env.CLICKHOUSE_PORT || '8123'}`);
      });
    } catch (error) {
      logger.error('Failed to start server', error);
      process.exit(1);
    }
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down server...');
    
    await this.storage.close();
    await this.metricsCollector.shutdown();
    
    logger.info('Server shut down successfully');
  }
}

// Start the server
const server = new LoggingAnalyticsAPI();
server.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await server.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await server.shutdown();
  process.exit(0);
});