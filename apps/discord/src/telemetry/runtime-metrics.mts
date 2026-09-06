import { type Attributes, createGauge, metrics } from '@thesharks/analytics'
import type { Client } from 'discord.js'
import { expiredFlagKeys } from '../features/registry.mjs'

const meter = metrics.getMeter('@thesharks/discord')

// Cumulative so the backend computes rates over any window.
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

/** Periodic process and Discord gauges, driven by the metrics collection task. */
export function collectRuntimeMetrics(client: Client): void {
  const labels: Attributes = { scope: 'process' }
  const memory = process.memoryUsage()
  botUptimeGauge.set(process.uptime(), labels)
  botMemoryGauge.set(memory.heapUsed, { ...labels, type: 'heap_used' })
  botMemoryGauge.set(memory.heapTotal, { ...labels, type: 'heap_total' })
  botMemoryGauge.set(memory.rss, { ...labels, type: 'rss' })
  expiredFlagsGauge.set(expiredFlagKeys().length, labels)

  const guilds = client.guilds.cache
  guildGauge.set(guilds.size, labels)
  userGauge.set(
    guilds.reduce((total, guild) => total + guild.memberCount, 0),
    labels,
  )
  channelGauge.set(client.channels.cache.size, labels)
  const latency = client.ws?.ping
  if (typeof latency === 'number') wsLatencyGauge.set(latency / 1000, labels)
  else wsLatencyGauge.clear(labels)
}
