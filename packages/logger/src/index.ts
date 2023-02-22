import { LogLevel } from "@sapphire/framework";
import * as LoggerPlugin from "@sapphire/plugin-logger";
import * as Sentry from "@wildbeast/sentry";

export class Logger extends LoggerPlugin.Logger {
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
    Sentry.withScope((scope) => {
      scope.setLevel(sentryLevel);
      Sentry.captureMessage(values.join(" "));
    });
    super.write(level, ...values);
  }
}

export * from "@sapphire/plugin-logger";
