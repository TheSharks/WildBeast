import {
  Plugin,
  preGenericsInitialization,
  SapphireClient,
} from "@sapphire/framework";
import type { ClientOptions } from "discord.js";
import { Logger, LoggerOptions } from "./index.js";

/**
 * @since 1.0.0
 */
export class LoggerPlugin extends Plugin {
  /**
   * @since 1.0.0
   */
  public static [preGenericsInitialization](
    this: SapphireClient,
    options: ClientOptions
  ): void {
    options.logger ??= {};
    options.logger.instance = new Logger(options.logger);
  }
}

declare module "@sapphire/framework" {
  export interface ClientLoggerOptions extends LoggerOptions {}
}

SapphireClient.plugins.registerPreGenericsInitializationHook(
  LoggerPlugin[preGenericsInitialization],
  "Logger-PreGenericsInitialization"
);
