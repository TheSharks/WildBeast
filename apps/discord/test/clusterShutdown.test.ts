import { afterEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  stop: vi.fn(),
  flush: vi.fn(),
  stale: () => undefined,
}))
vi.mock('../src/env.mjs', () => ({
  loadEnv: () => ({ DISCORD_TOKEN: 'test' }),
}))
vi.mock('../src/runtime/client.mjs', () => ({ logLevelFor: () => 0 }))
vi.mock('../src/sharding/config.mjs', () => ({
  parseClusteringConfig: () => ({
    mode: 'static',
    shardList: [0],
    totalShards: 1,
  }),
}))
vi.mock('../src/utils/redis.mjs', () => ({
  redisConnectionOptions: () => ({}),
}))
vi.mock('../src/fleet/discord.mjs', () => ({ discordShardingHost: () => ({}) }))
vi.mock('../src/fleet/manager.mjs', () => ({
  FleetManager: class {
    phase = 'serving'
    stop = state.stop
    constructor(options: { onStale: () => void }) {
      state.stale = options.onStale
    }
    start = vi.fn(async () => undefined)
  },
}))
vi.mock('discord.js', () => ({ ShardingManager: class {} }))
vi.mock('@thesharks/tui', () => ({ canStartDashboard: () => false }))
vi.mock('@thesharks/analytics/bridges/sapphire-logger', () => ({
  AnalyticsLogger: class {
    info = vi.fn()
    error = vi.fn()
    fatal = vi.fn()
  },
}))
vi.mock('@thesharks/analytics', () => ({
  Sentry: { captureException: vi.fn() },
  createGauge: () => ({ set: vi.fn() }),
  initOpenTelemetry: () => ({ shutdown: state.flush }),
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

it('joins repeated shutdown requests and preserves a failure exit code while draining', async () => {
  vi.stubEnv('WILDBEAST_CLUSTER_ID', 'test')
  vi.stubEnv('WILDBEAST_TUI_METRICS', '0')
  const drained = Promise.withResolvers<void>()
  const flushed = Promise.withResolvers<void>()
  state.stop.mockReturnValue(drained.promise)
  state.flush.mockReturnValue(flushed.promise)
  // Do not send real signals or exit the test worker.
  const handlers = new Map<string, () => void>()
  const once = process.once.bind(process)
  vi.spyOn(process, 'once').mockImplementation(((
    event: string,
    handler: () => void,
  ) => {
    if (event === 'SIGINT' || event === 'SIGTERM') {
      handlers.set(event, handler)
      return process
    }
    return once(event, handler)
  }) as typeof process.once)
  const exit = vi
    .spyOn(process, 'exit')
    .mockImplementation((() => undefined) as never)
  await import('../src/cluster.mjs')
  handlers.get('SIGINT')!()
  handlers.get('SIGTERM')!()
  state.stale()
  expect(state.stop).toHaveBeenCalledTimes(1)
  expect(exit).not.toHaveBeenCalled()
  expect(state.flush).not.toHaveBeenCalled()
  drained.resolve()
  await vi.waitFor(() => expect(state.flush).toHaveBeenCalledTimes(1))
  expect(exit).not.toHaveBeenCalled()
  flushed.resolve()
  await vi.waitFor(() => expect(exit).toHaveBeenCalledExactlyOnceWith(1))
})
