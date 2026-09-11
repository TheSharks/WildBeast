import type { LocalMetricPoint } from '@thesharks/analytics'
import { startDashboard } from './index.js'

const startedAt = Date.now()
let tick = 0
let total = 140
let logs: NodeJS.Timeout | undefined
const stop = () => {
  clearInterval(logs)
}
const dashboard = startDashboard({
  sampleSource: 'shard:0',
  status: () => ({
    title: 'DEMO / simulated data',
    phase: 'serving',
    startedAt,
    shards: [
      { id: 0, status: 'ready' },
      { id: 1, status: 'starting' },
    ],
  }),
  sample: async () => {
    tick++
    total += 3 + (tick % 8)
    const metric = (
      name: string,
      value: number,
      kind: LocalMetricPoint['kind'] = 'gauge',
      unit = '',
      attributes = {},
    ): LocalMetricPoint => ({
      name,
      description: 'Simulated data for exploring the dashboard',
      value,
      kind,
      unit,
      attributes,
      meter: 'demo',
      startTime: startedAt,
    })
    return {
      collectedAt: Date.now(),
      errors: 0,
      truncated: false,
      points: [
        metric('discord_commands_total', total, 'counter', '', {
          command: 'ping',
          shard_id: '0',
        }),
        metric('discord_command_errors_total', 2, 'counter'),
        metric('discord_guilds_total', 42),
        metric(
          'discord_websocket_latency_seconds',
          0.04 + Math.sin(tick / 2) * 0.015,
          'gauge',
          's',
        ),
        metric('discord_cluster_epoch', 3),
        metric('bullmq_queue_waiting', tick % 4),
        metric('bullmq_queue_failed', 0),
        metric(
          'discord_bot_memory_usage_bytes',
          94e6 + Math.sin(tick) * 8e6,
          'gauge',
          'By',
        ),
        {
          ...metric(
            'discord_command_duration_seconds',
            0.125,
            'histogram',
            's',
          ),
          count: total,
          sum: total * 0.125,
          min: 0.02,
          max: 0.8,
        },
      ],
    }
  },
  onShutdown: stop,
  onDetach: stop,
})
if (dashboard) {
  console.info(
    'INFO Demo ready. Press 2 to inspect metrics, / to search, ? for help.',
  )
  logs = setInterval(
    () =>
      console.info(
        tick % 5
          ? `INFO /ping completed on shard 0 (${total} commands)`
          : 'WARN Simulated gateway reconnect on shard 1',
      ),
    2_000,
  )
  process.once('SIGTERM', () => {
    dashboard.stop()
    stop()
  })
  process.once('SIGINT', () => {
    dashboard.stop()
    stop()
  })
} else {
  console.log(
    'The demo needs an interactive terminal. Run pnpm --filter @thesharks/tui demo in a terminal.',
  )
}
