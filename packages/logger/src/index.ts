import { LogLevel } from "@sapphire/framework";
import * as LoggerPlugin from "@sapphire/plugin-logger";
import { ProducerFactory } from "@thesharks/kafka";
import * as Sentry from "@thesharks/sentry";

export class Logger extends LoggerPlugin.Logger {
  private kafka: ProducerFactory | undefined;
  public constructor(options: LoggerPlugin.LoggerOptions) {
    super(options);
    if (process.env.KAFKA_BROKERS) {
      this.kafka = new ProducerFactory({
        topic: "logs",
        highWaterMark: 100,
      });
      this.kafka.start();
    }
  }
  public override write(level: LogLevel, ...values: readonly unknown[]): void {
    // map the log level to a Sentry level
    const sentryLevel = {
      [LogLevel.Trace]: "debug",
      [LogLevel.Debug]: "debug",
      [LogLevel.Info]: "info",
      [LogLevel.Warn]: "warning",
      [LogLevel.Error]: "error",
      [LogLevel.Fatal]: "fatal",
      [LogLevel.None]: "info",
    }[level] as Sentry.SeverityLevel;
    Sentry.addBreadcrumb({
      category: "log",
      level: sentryLevel,
      message: values.join(" "),
    });
    if (this.kafka) {
      this.kafka.addMessage({
        type: "log",
        payload: {
          level: sentryLevel,
          message: values.join(" "),
        },
        timestamp: new Date().toISOString(),
      });
    }
    super.write(level, ...values);
  }
}

export * from "@sapphire/plugin-logger";