import {
  Plugin,
  SapphireClient,
  container,
  postInitialization,
  preGenericsInitialization,
} from "@sapphire/framework";
import type { ClientOptions } from "discord.js";
import { AnalyticsLogger } from "./bridges/sapphire-logger.js";
import { AnalyticsClient } from "./lib/AnalyticsClient.js";
import "./lib/AnalyticsClientOptions.js";

export class AnalyticsPlugin extends Plugin {
  public static [preGenericsInitialization](
    this: SapphireClient,
    options: ClientOptions,
  ): void {
    options.logger ??= {};
    options.logger.instance = new AnalyticsLogger(options.logger);
  }

  public static [postInitialization](this: SapphireClient): void {
    const analyticsConfig = this.options.analytics;

    if (analyticsConfig) {
      try {
        const analyticsClient = new AnalyticsClient(analyticsConfig);
        container.analytics = analyticsClient;
      } catch (error) {
        this.logger?.error("Failed to initialize analytics plugin:", error);
        throw error;
      }
    } else {
      this.logger?.warn(
        "Analytics plugin loaded but no configuration provided",
      );
    }
  }
}

SapphireClient.plugins.registerPreGenericsInitializationHook(
  AnalyticsPlugin[preGenericsInitialization],
  "Analytics-PreGenericsInitialization",
);

SapphireClient.plugins.registerPostInitializationHook(
  AnalyticsPlugin[postInitialization],
  "Analytics-PostInitialization",
);

declare module "@sapphire/framework" {
  export interface ClientLoggerOptions {}
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Database/TimescaleDB
      DATABASE_URL?: string;
      TIMESCALE_HOST?: string;
      TIMESCALE_PORT?: string;
      TIMESCALE_DATABASE?: string;
      TIMESCALE_USER?: string;
      TIMESCALE_PASSWORD?: string;
      TIMESCALE_SSL?: string;
      TIMESCALE_MAX_CONNECTIONS?: string;
      TIMESCALE_IDLE_TIMEOUT?: string;
      TIMESCALE_CONNECTION_TIMEOUT?: string;

      // Elasticsearch (logs only)
      ELASTICSEARCH_NODE?: string;
      ELASTICSEARCH_LOGS_INDEX?: string;
      ELASTICSEARCH_USERNAME?: string;
      ELASTICSEARCH_PASSWORD?: string;
      ELASTICSEARCH_API_KEY?: string;
      ELASTICSEARCH_CLOUD_ID?: string;

      // Analytics
      METRICS_FLUSH_INTERVAL?: string;
      METRICS_BATCH_SIZE?: string;

      // Retention policies
      METRICS_RETENTION_DAYS?: string;
      METRICS_COMPRESSION_DAYS?: string;
      LOGS_RETENTION_DAYS?: string;
      LOGS_COMPRESSION_DAYS?: string;
    }
  }
}
