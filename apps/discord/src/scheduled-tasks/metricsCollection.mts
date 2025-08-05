import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks'
import type { AnalyticsClient } from '@thesharks/analytics'

export class MetricsCollectionTask extends ScheduledTask {
  public constructor(
    context: ScheduledTask.LoaderContext,
    options: ScheduledTask.Options,
  ) {
    super(context, {
      ...options,
      interval: 60_000, // 60 seconds
    })
  }

  public async run() {
    this.updateAllMetrics()
  }

  private updateAllMetrics() {
    const analytics = this.container.analytics
    if (!analytics) return

    const shardId = this.container.client.shard?.ids[0] ?? 0
    const shardLabels = { shard_id: shardId.toString() }

    this.updateBotMetrics(analytics, shardLabels)
    this.updateDiscordMetrics(analytics, shardLabels)
    this.updateSystemMetrics(analytics, shardLabels)
  }

  private updateBotMetrics(
    analytics: AnalyticsClient,
    shardLabels: { shard_id: string },
  ) {
    const uptimeGauge = analytics.gauge(
      'discord_bot_uptime_seconds',
      'Bot uptime in seconds',
    )

    const memoryGauge = analytics.gauge(
      'discord_bot_memory_usage_bytes',
      'Bot memory usage in bytes',
    )

    uptimeGauge.set(process.uptime(), shardLabels)
    memoryGauge.set(process.memoryUsage().heapUsed, {
      ...shardLabels,
      type: 'heap_used',
    })
    memoryGauge.set(process.memoryUsage().heapTotal, {
      ...shardLabels,
      type: 'heap_total',
    })
    memoryGauge.set(process.memoryUsage().rss, { ...shardLabels, type: 'rss' })
  }

  private updateDiscordMetrics(
    analytics: AnalyticsClient,
    shardLabels: { shard_id: string },
  ) {
    const guildGauge = analytics.gauge(
      'discord_guilds_total',
      'Total number of Discord guilds the bot is in',
    )

    const userGauge = analytics.gauge(
      'discord_users_total',
      'Total number of Discord users the bot can see',
    )

    const channelGauge = analytics.gauge(
      'discord_channels_total',
      'Total number of Discord channels the bot can see',
    )

    const wsLatencyGauge = analytics.gauge(
      'discord_websocket_latency_milliseconds',
      'Discord WebSocket latency in milliseconds',
    )

    const guilds = this.container.client.guilds.cache
    const channels = this.container.client.channels.cache
    const totalUsers = guilds.reduce((acc, guild) => acc + guild.memberCount, 0)

    guildGauge.set(guilds.size, shardLabels)
    userGauge.set(totalUsers, shardLabels)
    channelGauge.set(channels.size, shardLabels)
    wsLatencyGauge.set(this.container.client.ws.ping, shardLabels)
  }

  private updateSystemMetrics(
    analytics: AnalyticsClient,
    shardLabels: { shard_id: string },
  ) {
    const cpuUsage = process.cpuUsage()
    const cpuGauge = analytics.gauge(
      'discord_bot_cpu_usage_microseconds',
      'Bot CPU usage in microseconds',
    )

    cpuGauge.set(cpuUsage.user, { ...shardLabels, type: 'user' })
    cpuGauge.set(cpuUsage.system, { ...shardLabels, type: 'system' })
  }
}

declare module '@sapphire/plugin-scheduled-tasks' {
  interface ScheduledTasks {
    metricsCollection: never
  }
}
