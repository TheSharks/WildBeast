import {
  Plugin,
  postInitialization,
  preGenericsInitialization,
  SapphireClient,
} from '@sapphire/framework'
import type { ClientOptions } from 'discord.js'
import { AnalyticsLogger } from './bridges/sapphire-logger.js'

export class AnalyticsPlugin extends Plugin {
  public static [preGenericsInitialization](
    this: SapphireClient,
    options: ClientOptions,
  ): void {
    options.logger ??= {}
    options.logger.instance = new AnalyticsLogger(options.logger)
  }

  public static [postInitialization](this: SapphireClient): void {
    this.logger?.debug('Analytics plugin initialized (OpenTelemetry only)')
  }
}

SapphireClient.plugins.registerPreGenericsInitializationHook(
  AnalyticsPlugin[preGenericsInitialization],
  'Analytics-PreGenericsInitialization',
)

SapphireClient.plugins.registerPostInitializationHook(
  AnalyticsPlugin[postInitialization],
  'Analytics-PostInitialization',
)

declare module '@sapphire/framework' {
  export interface ClientLoggerOptions {}
}
