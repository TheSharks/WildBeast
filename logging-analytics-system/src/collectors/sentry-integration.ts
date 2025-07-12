import * as Sentry from '@sentry/node';
import { Integration, Event, EventHint, Breadcrumb } from '@sentry/types';
import { Logger } from 'winston';
import { ClickHouseStorage, LogEntry } from '../storage/clickhouse-client';

export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate?: number;
  debug?: boolean;
  attachStacktrace?: boolean;
  serverName?: string;
}

export class SentryIntegration {
  private logger: Logger;
  private storage: ClickHouseStorage;
  private config: SentryConfig;

  constructor(config: SentryConfig, logger: Logger, storage: ClickHouseStorage) {
    this.config = config;
    this.logger = logger;
    this.storage = storage;
  }

  initialize(): void {
    Sentry.init({
      dsn: this.config.dsn,
      environment: this.config.environment,
      release: this.config.release,
      tracesSampleRate: this.config.tracesSampleRate || 0.1,
      debug: this.config.debug || false,
      attachStacktrace: this.config.attachStacktrace ?? true,
      serverName: this.config.serverName,
      integrations: [
        new CustomLogIntegration(this.storage, this.logger),
      ],
      beforeSend: (event: Event, hint?: EventHint) => {
        // Add custom processing before sending to Sentry
        this.processEventBeforeSend(event, hint);
        return event;
      },
      beforeBreadcrumb: (breadcrumb: Breadcrumb) => {
        // Filter or modify breadcrumbs
        return this.processBreadcrumb(breadcrumb);
      },
    });

    this.logger.info('Sentry integration initialized');
  }

  private processEventBeforeSend(event: Event, hint?: EventHint): void {
    // Store event data in ClickHouse for correlation
    const logEntry: LogEntry = {
      timestamp: new Date(),
      level: event.level || 'error',
      message: event.message || 'Sentry event',
      service: 'sentry-integration',
      host: event.server_name || 'unknown',
      environment: event.environment || 'unknown',
      trace_id: event.contexts?.trace?.trace_id,
      span_id: event.contexts?.trace?.span_id,
      user_id: event.user?.id?.toString(),
      request_id: event.request?.headers?.['x-request-id'] as string,
      metadata: {
        event_id: event.event_id,
        transaction: event.transaction,
        platform: event.platform,
        tags: event.tags,
        extra: event.extra,
      },
      sentry_event_id: event.event_id,
    };

    // Store asynchronously to not block Sentry
    this.storage.insertLogs([logEntry]).catch(err => {
      this.logger.error('Failed to store Sentry event in ClickHouse', err);
    });
  }

  private processBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
    // Filter out noisy breadcrumbs
    if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
      return null;
    }

    // Add custom metadata
    if (breadcrumb.category === 'http') {
      breadcrumb.data = {
        ...breadcrumb.data,
        logged_at: new Date().toISOString(),
      };
    }

    return breadcrumb;
  }

  // Method to capture custom events
  captureEvent(
    message: string,
    level: Sentry.SeverityLevel,
    extra?: Record<string, any>,
    tags?: Record<string, string>
  ): string {
    const eventId = Sentry.captureMessage(message, level);
    
    if (extra) {
      Sentry.setContext('extra_data', extra);
    }
    
    if (tags) {
      Object.entries(tags).forEach(([key, value]) => {
        Sentry.setTag(key, value);
      });
    }

    return eventId;
  }

  // Method to capture exceptions with additional context
  captureException(
    error: Error,
    context?: {
      user?: { id: string; email?: string };
      tags?: Record<string, string>;
      extra?: Record<string, any>;
      level?: Sentry.SeverityLevel;
    }
  ): string {
    if (context?.user) {
      Sentry.setUser(context.user);
    }

    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        Sentry.setTag(key, value);
      });
    }

    if (context?.extra) {
      Sentry.setContext('extra_data', context.extra);
    }

    return Sentry.captureException(error, {
      level: context?.level,
    });
  }

  // Add breadcrumb
  addBreadcrumb(breadcrumb: Breadcrumb): void {
    Sentry.addBreadcrumb(breadcrumb);
  }

  // Create a new Sentry scope for isolated context
  withScope<T>(callback: (scope: Sentry.Scope) => T): T {
    return Sentry.withScope(callback);
  }

  // Start a transaction for performance monitoring
  startTransaction(
    name: string,
    op: string,
    data?: Record<string, any>
  ): Sentry.Transaction {
    return Sentry.startTransaction({
      name,
      op,
      data,
    });
  }
}

// Custom Sentry Integration that forwards logs to ClickHouse
class CustomLogIntegration implements Integration {
  public static id = 'CustomLogIntegration';
  public name: string = CustomLogIntegration.id;

  constructor(
    private storage: ClickHouseStorage,
    private logger: Logger
  ) {}

  setupOnce(): void {
    // Hook into Sentry's internal logging
    Sentry.addGlobalEventProcessor(async (event: Event) => {
      try {
        // Process and store all Sentry events
        if (event.event_id) {
          const logEntry: LogEntry = {
            timestamp: new Date(event.timestamp || Date.now()),
            level: event.level || 'error',
            message: this.extractMessage(event),
            service: 'sentry',
            host: event.server_name || 'unknown',
            environment: event.environment || 'unknown',
            trace_id: event.contexts?.trace?.trace_id,
            span_id: event.contexts?.trace?.span_id,
            user_id: event.user?.id?.toString(),
            metadata: {
              platform: event.platform,
              sdk: event.sdk,
              modules: event.modules,
              extra: event.extra,
              tags: event.tags,
              breadcrumbs: event.breadcrumbs,
            },
            sentry_event_id: event.event_id,
          };

          await this.storage.insertLogs([logEntry]);
        }
      } catch (error) {
        this.logger.error('Failed to process Sentry event', error);
      }

      return event;
    });
  }

  private extractMessage(event: Event): string {
    if (event.message) return event.message;
    if (event.exception?.values?.[0]?.value) {
      return event.exception.values[0].value;
    }
    return 'Unknown Sentry event';
  }
}

// Webhook handler for Sentry webhooks
export class SentryWebhookHandler {
  constructor(
    private storage: ClickHouseStorage,
    private logger: Logger
  ) {}

  async handleWebhook(payload: any): Promise<void> {
    try {
      const { action, data } = payload;

      switch (action) {
        case 'issue.created':
        case 'issue.resolved':
        case 'issue.ignored':
        case 'issue.assigned':
          await this.handleIssueEvent(action, data);
          break;
        
        case 'error.created':
          await this.handleErrorEvent(data);
          break;
        
        case 'comment.created':
        case 'comment.updated':
        case 'comment.deleted':
          await this.handleCommentEvent(action, data);
          break;
        
        default:
          this.logger.debug(`Unhandled Sentry webhook action: ${action}`);
      }
    } catch (error) {
      this.logger.error('Failed to handle Sentry webhook', error);
      throw error;
    }
  }

  private async handleIssueEvent(action: string, data: any): Promise<void> {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      level: 'info',
      message: `Sentry issue ${action}: ${data.issue.title}`,
      service: 'sentry-webhook',
      host: 'webhook',
      environment: data.project.environment || 'unknown',
      metadata: {
        action,
        issue_id: data.issue.id,
        issue_title: data.issue.title,
        issue_status: data.issue.status,
        project_id: data.project.id,
        project_name: data.project.name,
        culprit: data.issue.culprit,
        permalink: data.issue.permalink,
        event_count: data.issue.count,
        user_count: data.issue.userCount,
      },
      sentry_issue_id: data.issue.id.toString(),
    };

    await this.storage.insertLogs([logEntry]);
  }

  private async handleErrorEvent(data: any): Promise<void> {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      level: 'error',
      message: data.error.message || 'Sentry error event',
      service: 'sentry-webhook',
      host: 'webhook',
      environment: data.project.environment || 'unknown',
      trace_id: data.error.trace_id,
      metadata: {
        error_id: data.error.id,
        error_type: data.error.type,
        error_value: data.error.value,
        project_id: data.project.id,
        project_name: data.project.name,
        platform: data.error.platform,
        release: data.error.release,
      },
      sentry_event_id: data.error.event_id,
    };

    await this.storage.insertLogs([logEntry]);
  }

  private async handleCommentEvent(action: string, data: any): Promise<void> {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      level: 'info',
      message: `Sentry comment ${action}`,
      service: 'sentry-webhook',
      host: 'webhook',
      environment: data.project.environment || 'unknown',
      metadata: {
        action,
        comment_id: data.comment.id,
        issue_id: data.issue.id,
        user: data.comment.user,
        comment: data.comment.data,
      },
      sentry_issue_id: data.issue.id.toString(),
    };

    await this.storage.insertLogs([logEntry]);
  }
}