import { LogLevel } from "@sapphire/framework";
import * as LoggerPlugin from "@sapphire/plugin-logger";
import * as Sentry from "@sentry/node";
import { isAnalyticsInitialized, getAnalytics } from "@thesharks/analytics";

export interface LogContext {
  user_id?: string;
  guild_id?: string;
  channel_id?: string;
  command?: string;
  trace_id?: string;
  span_id?: string;
  metadata?: Record<string, any>;
}

export class EnhancedLogger extends LoggerPlugin.Logger {
  private logBuffer: Array<{
    level: LogLevel;
    message: string;
    context?: LogContext;
    timestamp: Date;
    error?: Error;
  }> = [];

  public constructor(options: LoggerPlugin.LoggerOptions) {
    super(options);
  }

  public override write(level: LogLevel, ...values: readonly unknown[]): void {
    // Extract context and error from values
    const { message, context, error } = this.parseLogValues(values);
    
    // Map the log level to a Sentry level
    const sentryLevel = this.getSentryLevel(level);
    
    // Add to Sentry breadcrumb
    Sentry.addBreadcrumb({
      category: 'log',
      level: sentryLevel,
      message,
      data: context?.metadata,
    });

    // If it's an error, capture it in Sentry
    if (error || level >= LogLevel.Error) {
      Sentry.captureException(error || new Error(message), {
        level: sentryLevel,
        tags: {
          source: 'enhanced-logger',
          guild_id: context?.guild_id,
          user_id: context?.user_id,
          command: context?.command,
        },
        extra: {
          ...context?.metadata,
          trace_id: context?.trace_id,
          span_id: context?.span_id,
        },
      });
    }

    // Send to analytics if available
    if (isAnalyticsInitialized()) {
      try {
        const analytics = getAnalytics();
        analytics.log({
          timestamp: new Date(),
          level: this.getLevelString(level),
          message,
          source: 'enhanced-logger',
          trace_id: context?.trace_id,
          span_id: context?.span_id,
          user_id: context?.user_id,
          guild_id: context?.guild_id,
          channel_id: context?.channel_id,
          command: context?.command,
          metadata: context?.metadata,
          error,
        });
      } catch (analyticsError) {
        // Don't fail logging if analytics fails
        console.warn('Failed to send log to analytics:', analyticsError);
      }
    } else {
      // Buffer logs if analytics isn't initialized yet
      this.logBuffer.push({
        level,
        message,
        context,
        timestamp: new Date(),
        error,
      });
    }

    // Call parent write method
    super.write(level, ...values);
  }

  // Enhanced logging methods with context support
  public logWithContext(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    this.write(level, message, { context, error });
  }

  public infoWithContext(message: string, context?: LogContext): void {
    this.logWithContext(LogLevel.Info, message, context);
  }

  public debugWithContext(message: string, context?: LogContext): void {
    this.logWithContext(LogLevel.Debug, message, context);
  }

  public warnWithContext(message: string, context?: LogContext): void {
    this.logWithContext(LogLevel.Warn, message, context);
  }

  public errorWithContext(message: string, context?: LogContext, error?: Error): void {
    this.logWithContext(LogLevel.Error, message, context, error);
  }

  public fatalWithContext(message: string, context?: LogContext, error?: Error): void {
    this.logWithContext(LogLevel.Fatal, message, context, error);
  }

  // Command-specific logging
  public logCommandStart(command: string, userId: string, guildId?: string, channelId?: string, args?: any[]): void {
    this.infoWithContext(`Command ${command} started`, {
      command,
      user_id: userId,
      guild_id: guildId,
      channel_id: channelId,
      metadata: { args },
    });
  }

  public logCommandSuccess(command: string, userId: string, guildId?: string, channelId?: string, duration?: number): void {
    this.infoWithContext(`Command ${command} completed successfully`, {
      command,
      user_id: userId,
      guild_id: guildId,
      channel_id: channelId,
      metadata: { duration, status: 'success' },
    });
  }

  public logCommandError(command: string, userId: string, error: Error, guildId?: string, channelId?: string, duration?: number): void {
    this.errorWithContext(`Command ${command} failed`, {
      command,
      user_id: userId,
      guild_id: guildId,
      channel_id: channelId,
      metadata: { duration, status: 'error' },
    }, error);
  }

  // Discord-specific logging
  public logDiscordEvent(event: string, data: any, context?: LogContext): void {
    this.infoWithContext(`Discord event: ${event}`, {
      ...context,
      metadata: { event, ...data },
    });
  }

  public logGuildEvent(event: string, guildId: string, data: any): void {
    this.logDiscordEvent(event, data, { guild_id: guildId });
  }

  public logUserEvent(event: string, userId: string, guildId?: string, data?: any): void {
    this.logDiscordEvent(event, data, { user_id: userId, guild_id: guildId });
  }

  // Performance logging
  public logPerformance(operation: string, duration: number, metadata?: Record<string, any>): void {
    const level = duration > 5000 ? LogLevel.Warn : duration > 1000 ? LogLevel.Info : LogLevel.Debug;
    this.logWithContext(level, `Performance: ${operation} took ${duration}ms`, {
      metadata: { operation, duration, ...metadata },
    });
  }

  // Database logging
  public logDatabaseQuery(query: string, duration: number, success: boolean, metadata?: Record<string, any>): void {
    const level = !success ? LogLevel.Error : duration > 1000 ? LogLevel.Warn : LogLevel.Debug;
    this.logWithContext(level, `Database query ${success ? 'completed' : 'failed'}: ${query}`, {
      metadata: { query, duration, success, ...metadata },
    });
  }

  // API logging
  public logApiRequest(method: string, url: string, status: number, duration: number, metadata?: Record<string, any>): void {
    const level = status >= 400 ? LogLevel.Error : status >= 300 ? LogLevel.Warn : LogLevel.Info;
    this.logWithContext(level, `API ${method} ${url} - ${status}`, {
      metadata: { method, url, status, duration, ...metadata },
    });
  }

  // Flush buffered logs when analytics becomes available
  public flushBufferedLogs(): void {
    if (isAnalyticsInitialized() && this.logBuffer.length > 0) {
      const analytics = getAnalytics();
      
      for (const bufferedLog of this.logBuffer) {
        try {
          analytics.log({
            timestamp: bufferedLog.timestamp,
            level: this.getLevelString(bufferedLog.level),
            message: bufferedLog.message,
            source: 'enhanced-logger',
            trace_id: bufferedLog.context?.trace_id,
            span_id: bufferedLog.context?.span_id,
            user_id: bufferedLog.context?.user_id,
            guild_id: bufferedLog.context?.guild_id,
            channel_id: bufferedLog.context?.channel_id,
            command: bufferedLog.context?.command,
            metadata: bufferedLog.context?.metadata,
            error: bufferedLog.error,
          });
        } catch (error) {
          console.warn('Failed to flush buffered log:', error);
        }
      }
      
      this.logBuffer = [];
    }
  }

  private parseLogValues(values: readonly unknown[]): {
    message: string;
    context?: LogContext;
    error?: Error;
  } {
    const message = values.join(' ');
    let context: LogContext | undefined;
    let error: Error | undefined;

    // Look for context object and error in the values
    for (const value of values) {
      if (value && typeof value === 'object') {
        if (value instanceof Error) {
          error = value;
        } else if ('context' in value) {
          context = (value as any).context;
        } else if ('error' in value) {
          error = (value as any).error;
        }
      }
    }

    return { message, context, error };
  }

  private getSentryLevel(level: LogLevel): Sentry.SeverityLevel {
    switch (level) {
      case LogLevel.Trace:
      case LogLevel.Debug:
        return 'debug';
      case LogLevel.Info:
        return 'info';
      case LogLevel.Warn:
        return 'warning';
      case LogLevel.Error:
        return 'error';
      case LogLevel.Fatal:
        return 'fatal';
      default:
        return 'info';
    }
  }

  private getLevelString(level: LogLevel): string {
    switch (level) {
      case LogLevel.Trace:
        return 'trace';
      case LogLevel.Debug:
        return 'debug';
      case LogLevel.Info:
        return 'info';
      case LogLevel.Warn:
        return 'warn';
      case LogLevel.Error:
        return 'error';
      case LogLevel.Fatal:
        return 'fatal';
      default:
        return 'info';
    }
  }
}