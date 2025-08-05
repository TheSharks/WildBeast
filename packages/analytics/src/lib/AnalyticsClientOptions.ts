import type { AnalyticsConfig } from '../types.js'

declare module '@sapphire/pieces' {
  interface Container {
    analytics: import('./AnalyticsClient.js').AnalyticsClient
  }
}

declare module 'discord.js' {
  interface ClientOptions {
    analytics?: AnalyticsConfig
  }
}
