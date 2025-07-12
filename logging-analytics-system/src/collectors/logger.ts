import winston from 'winston';
import Transport from 'winston-transport';
import * as Sentry from '@sentry/node';
import { LogEntry } from '../storage/clickhouse-client';

interface LoggerOptions {
  service: string;
  environment?: string;
  apiEndpoint?: string;
  apiToken?: string;
  sentryDsn?: string;
  enableConsole?: boolean;
  enableFile?: boolean;
  logLevel?: string;
  metadata?: Record<string, any>;
}

interface LogContext {
  traceId?: string;
  spanId?: string;
  userId?: string;
  requestId?: string;
  [key: string]: any;
}

// Custom transport for sending logs to our API
class LogAnalyticsTransport extends Transport {
  private apiEndpoint: string;
  private apiToken: string;
  private service: string;
  private environment: string;
  private buffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timer;
  private maxBufferSize = 100;
  private flushIntervalMs = 5000;

  constructor(options: {
    apiEndpoint: string;
    apiToken: string;
    service: string;
    environment: string;
  }) {
    super();
    this.apiEndpoint = options.apiEndpoint;
    this.apiToken = options.apiToken;
    this.service = options.service;
    this.environment = options.environment;

    // Start flush interval
    this.flushInterval = setInterval(() => this.flush(), this.flushIntervalMs);
  }

  async log(info: any, callback: () => void): Promise<void> {
    const logEntry: LogEntry = {
      timestamp: new Date(info.timestamp || Date.now()),
      level: info.level,
      message: info.message,
      service: this.service,
      host: info.hostname || require('os').hostname(),
      environment: this.environment,
      trace_id: info.traceId,
      span_id: info.spanId,
      user_id: info.userId,
      request_id: info.requestId,
      metadata: {
        ...info.metadata,
        ...info.meta,
      },
      sentry_event_id: info.sentryEventId,
      sentry_issue_id: info.sentryIssueId,
    };

    this.buffer.push(logEntry);

    if (this.buffer.length >= this.maxBufferSize) {
      await this.flush();
    }

    callback();
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const logs = [...this.buffer];
    this.buffer = [];

    try {
      const response = await fetch(`${this.apiEndpoint}/api/logs/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiToken}`,
        },
        body: JSON.stringify(logs),
      });

      if (!response.ok) {
        // Put logs back in buffer if failed
        this.buffer.unshift(...logs);
        console.error(`Failed to send logs: ${response.statusText}`);
      }
    } catch (error) {
      // Put logs back in buffer if failed
      this.buffer.unshift(...logs);
      console.error('Failed to send logs:', error);
    }
  }

  close(): void {
    clearInterval(this.flushInterval);
    this.flush();
  }
}

export class LogAnalyticsLogger {
  private logger: winston.Logger;
  private context: LogContext = {};
  private service: string;
  private environment: string;

  constructor(options: LoggerOptions) {
    this.service = options.service;
    this.environment = options.environment || process.env.NODE_ENV || 'development';

    const transports: winston.transport[] = [];

    // Console transport
    if (options.enableConsole !== false) {
      transports.push(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} [${level}] ${message}${metaStr}`;
          })
        ),
      }));
    }

    // File transport
    if (options.enableFile) {
      transports.push(new winston.transports.File({
        filename: `logs/${this.service}-error.log`,
        level: 'error',
      }));
      transports.push(new winston.transports.File({
        filename: `logs/${this.service}-combined.log`,
      }));
    }

    // Custom transport for log analytics API
    if (options.apiEndpoint && options.apiToken) {
      transports.push(new LogAnalyticsTransport({
        apiEndpoint: options.apiEndpoint,
        apiToken: options.apiToken,
        service: this.service,
        environment: this.environment,
      }));
    }

    // Initialize Winston logger
    this.logger = winston.createLogger({
      level: options.logLevel || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: {
        service: this.service,
        environment: this.environment,
        ...options.metadata,
      },
      transports,
    });

    // Initialize Sentry if DSN provided
    if (options.sentryDsn) {
      Sentry.init({
        dsn: options.sentryDsn,
        environment: this.environment,
        serverName: this.service,
        integrations: [
          new Sentry.Integrations.Http({ tracing: true }),
        ],
        tracesSampleRate: 0.1,
      });
    }
  }

  // Set context for all subsequent logs
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  // Clear specific context keys
  clearContext(...keys: string[]): void {
    if (keys.length === 0) {
      this.context = {};
    } else {
      keys.forEach(key => delete this.context[key]);
    }
  }

  // Core logging methods
  debug(message: string, meta?: Record<string, any>): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, any>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.log('warn', message, meta);
  }

  error(message: string, error?: Error | Record<string, any>, meta?: Record<string, any>): void {
    const errorMeta = error instanceof Error ? {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
    } : error;

    this.log('error', message, { ...errorMeta, ...meta });

    // Send to Sentry if initialized
    if (error instanceof Error && Sentry.getCurrentHub().getClient()) {
      Sentry.captureException(error, {
        tags: {
          service: this.service,
          environment: this.environment,
        },
        extra: meta,
      });
    }
  }

  // Generic log method
  private log(level: string, message: string, meta?: Record<string, any>): void {
    const logData = {
      level,
      message,
      ...this.context,
      ...meta,
      timestamp: new Date().toISOString(),
    };

    this.logger.log(level, message, logData);
  }

  // Specialized logging methods
  http(req: any, res: any, meta?: Record<string, any>): void {
    const httpMeta = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      ...meta,
    };

    this.info(`HTTP ${req.method} ${req.url} ${res.statusCode}`, httpMeta);
  }

  database(operation: string, query: string, duration: number, meta?: Record<string, any>): void {
    const dbMeta = {
      operation,
      query: query.substring(0, 1000), // Truncate long queries
      duration,
      ...meta,
    };

    this.info(`Database ${operation} completed in ${duration}ms`, dbMeta);
  }

  metric(name: string, value: number, tags?: Record<string, string>): void {
    this.info(`Metric: ${name}`, {
      metric: {
        name,
        value,
        tags,
      },
    });
  }

  // Create child logger with additional context
  child(context: LogContext): LogAnalyticsLogger {
    const childLogger = Object.create(this);
    childLogger.context = { ...this.context, ...context };
    return childLogger;
  }

  // Express middleware
  expressMiddleware() {
    return (req: any, res: any, next: any) => {
      const start = Date.now();
      const requestId = req.headers['x-request-id'] || require('crypto').randomUUID();

      // Add request ID to request object
      req.requestId = requestId;

      // Create child logger with request context
      req.logger = this.child({
        requestId,
        method: req.method,
        path: req.path,
        ip: req.ip,
      });

      // Log request
      req.logger.info(`Request started: ${req.method} ${req.path}`);

      // Intercept response
      const originalSend = res.send;
      res.send = function (data: any) {
        res.send = originalSend;
        
        const duration = Date.now() - start;
        req.logger.info(`Request completed: ${req.method} ${req.path}`, {
          statusCode: res.statusCode,
          duration,
        });

        return res.send(data);
      };

      next();
    };
  }

  // Performance tracking
  startTimer(name: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.info(`Timer ${name} completed`, { duration });
    };
  }

  // Async operation wrapper with automatic error logging
  async wrapAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    meta?: Record<string, any>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.info(`${operation} completed`, { duration, ...meta });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`${operation} failed`, error as Error, { duration, ...meta });
      throw error;
    }
  }

  // Shutdown logger
  async shutdown(): Promise<void> {
    // Flush any pending logs
    await new Promise(resolve => {
      this.logger.on('finish', resolve);
      this.logger.end();
    });

    // Close Sentry
    if (Sentry.getCurrentHub().getClient()) {
      await Sentry.close(2000);
    }
  }
}

// Factory function for easy logger creation
export function createLogger(options: LoggerOptions): LogAnalyticsLogger {
  return new LogAnalyticsLogger(options);
}