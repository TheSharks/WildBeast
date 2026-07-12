import type { ScheduledTask } from '@sapphire/plugin-scheduled-tasks'
import { type Attributes, createGauge, metrics } from '@thesharks/analytics'
import { expiredFlagKeys } from '../features/registry.mjs'
import { TracedScheduledTask } from '../structures/task.mjs'

const meter = metrics.getMeter('@thesharks/discord')

// Cumulative counter (not an interval gauge) so the backend can compute
// rates over any window and scrape gaps don't lose data.
const cpuCounter = meter.createObservableCounter('discord_bot_cpu_seconds', {
  description: 'Cumulative process CPU time',
  unit: 's',
})
cpuCounter.addCallback((result) => {
  const usage = process.cpuUsage()
  result.observe(usage.user / 1_000_000, { scope: 'process', type: 'user' })
  result.observe(usage.system / 1_000_000, {
    scope: 'process',
    type: 'system',
  })
})

const botUptimeGauge = createGauge(
  '@thesharks/discord',
  'discord_bot_uptime_seconds',
  'Bot uptime in seconds',
  's',
)
const botMemoryGauge = createGauge(
  '@thesharks/discord',
  'discord_bot_memory_usage_bytes',
  'Bot memory usage in bytes',
  'By',
)
const guildGauge = createGauge(
  '@thesharks/discord',
  'discord_guilds_total',
  'Total number of Discord guilds the bot is in',
)
const userGauge = createGauge(
  '@thesharks/discord',
  'discord_guild_member_total',
  'Total number of guild member entries the bot can see',
)
const channelGauge = createGauge(
  '@thesharks/discord',
  'discord_channels_total',
  'Total number of Discord channels the bot can see',
)
const wsLatencyGauge = createGauge(
  '@thesharks/discord',
  'discord_websocket_latency_seconds',
  'Discord WebSocket latency in seconds',
  's',
)
const expiredFlagsGauge = createGauge(
  '@thesharks/discord',
  'discord_feature_flags_expired',
  'Registered runtime flags past their expiry date',
)

export class MetricsCollectionTask extends TracedScheduledTask {
  public constructor(
    context: ScheduledTask.LoaderContext,
    options: ScheduledTask.Options,
  ) {
    super(context, {
      ...options,
      interval: 60_000, // 60 seconds
    })
  }

  public run() {
    try {
      this.updateAllMetrics()
    } catch (error) {
      this.container.logger?.warn('Metrics collection failed', error)
    }
  }

  private updateAllMetrics() {
    this.updateBotMetrics()
    this.updateDiscordMetrics()
  }

  private updateBotMetrics() {
    const memory = process.memoryUsage()
    const labels: Attributes = { scope: 'process' }

    botUptimeGauge.set(process.uptime(), labels)
    botMemoryGauge.set(memory.heapUsed, { ...labels, type: 'heap_used' })
    botMemoryGauge.set(memory.heapTotal, { ...labels, type: 'heap_total' })
    botMemoryGauge.set(memory.rss, { ...labels, type: 'rss' })
    // Continuously observable (dashboards, alerting), unlike the one-shot
    // boot warning in initFeatureFlags.
    expiredFlagsGauge.set(expiredFlagKeys().length, labels)
  }

  private updateDiscordMetrics() {
    const labels: Attributes = { scope: 'process' }
    const guilds = this.container.client.guilds.cache
    const channels = this.container.client.channels.cache
    const totalUsers = guilds.reduce((acc, guild) => acc + guild.memberCount, 0)

    guildGauge.set(guilds.size, labels)
    userGauge.set(totalUsers, labels)
    channelGauge.set(channels.size, labels)

    const wsLatency = this.container.client.ws?.ping
    if (typeof wsLatency === 'number') {
      // Convert milliseconds to seconds for consistency
      wsLatencyGauge.set(wsLatency / 1000, labels)
    } else {
      wsLatencyGauge.clear(labels)
    }
  }
}

declare module '@sapphire/plugin-scheduled-tasks' {
  interface ScheduledTasks {
    metricsCollection: never
  }
}
