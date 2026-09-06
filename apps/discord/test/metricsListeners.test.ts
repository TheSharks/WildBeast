import { EventEmitter } from 'node:events'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { container, ListenerStore } from '@sapphire/framework'
import * as Sentry from '@sentry/node'
import { captureMetrics, silentLogger } from '@thesharks/test-utils'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

// Installed before the listener modules load so their meters bind to it.
const otelCapture = captureMetrics('delta')

const { GuildJoinedMetricsListener, GuildLeftMetricsListener } = await import(
  '../src/listeners/metrics/guildEvents.mjs'
)
const { RestRateLimitedListener } = await import(
  '../src/listeners/metrics/restEvents.mjs'
)
const { SelectMenuInteractionListener } = await import(
  '../src/listeners/metrics/interactionEvents.mjs'
)
const { GatewayEventMetricsListener } = await import(
  '../src/listeners/metrics/gatewayEvents.mjs'
)
const { TaskErrorMetricsListener, TaskSuccessMetricsListener } = await import(
  '../src/listeners/metrics/taskEvents.mjs'
)
const { TaskDeferred } = await import('../src/structures/task.mjs')

const fakeClient = new EventEmitter()
Object.assign(fakeClient, { rest: new EventEmitter(), options: {} })
container.client = fakeClient as never
container.logger = silentLogger
const store = new ListenerStore()

function pieceContext(name: string) {
  return {
    name,
    path: fileURLToPath(import.meta.url),
    root: dirname(fileURLToPath(import.meta.url)),
    store,
  } as never
}

interface CapturedMetric {
  name: string
  type: string
  value: number
  unit?: string
  attributes?: Record<string, unknown>
}
const captured: CapturedMetric[] = []

interface Point {
  attributes: Record<string, unknown>
  value: unknown
}

async function collect(...names: string[]): Promise<Map<string, Point[]>> {
  const out = new Map<string, Point[]>(names.map((name) => [name, []]))
  for (const batch of await otelCapture.collect()) {
    for (const scope of batch.scopeMetrics ?? []) {
      for (const metric of scope.metrics) {
        const bucket = out.get(metric.descriptor.name)
        if (!bucket) continue
        for (const point of metric.dataPoints as Point[])
          bucket.push({
            attributes: { ...point.attributes },
            value: point.value,
          })
      }
    }
  }
  return out
}

function labelKeys(attributes: Record<string, unknown>): string[] {
  return Object.keys(attributes)
    .filter((key) => !key.startsWith('sentry.') && key !== 'server.address')
    .sort()
}

beforeAll(() => {
  Sentry.init({ skipOpenTelemetrySetup: true, registerEsmLoaderHooks: false })
  Sentry.getClient()?.on('afterCaptureMetric', (metric) => {
    captured.push(metric as CapturedMetric)
  })
})
beforeEach(() => {
  captured.length = 0
})

describe('guild membership metrics', () => {
  it('counts joins and leaves with guild size and shard attached', () => {
    const guild = { id: '1', shardId: 2, memberCount: 42 } as never
    new GuildJoinedMetricsListener(pieceContext('guildJoinedMetrics'), {}).run(
      guild,
    )
    new GuildLeftMetricsListener(pieceContext('guildLeftMetrics'), {}).run(
      guild,
    )
    const names = captured.map((metric) => metric.name)
    expect(names).toEqual(['discord.guild.joined', 'discord.guild.left'])
    for (const metric of captured) {
      expect(labelKeys(metric.attributes ?? {})).toEqual([
        'member_count',
        'shard_id',
      ])
      expect(metric.attributes?.shard_id).toBe('2')
    }
  })
})

describe('rate limit metrics', () => {
  it('records the imposed wait as a distribution and counts the route', async () => {
    new RestRateLimitedListener(pieceContext('restEvents'), {}).run({
      route: '/channels/:id/messages',
      method: 'POST',
      global: false,
      retryAfter: 1234,
    } as never)
    const distribution = captured.find(
      (metric) => metric.name === 'discord.rest.rate_limit.wait',
    )
    expect(distribution?.value).toBe(1234)
    expect(distribution?.attributes?.global).toBe('false')
    const points = await collect('discord_rest_rate_limited_total')
    const point = points.get('discord_rest_rate_limited_total')?.[0]
    expect(labelKeys(point?.attributes ?? {})).toEqual([
      'global',
      'method',
      'route',
    ])
  })
})

describe('component and gateway metrics', () => {
  it('counts every select menu kind and ignores buttons in the select listener', async () => {
    const listener = new SelectMenuInteractionListener(
      pieceContext('selectMenuInteractionMetrics'),
      {},
    )
    const interaction = (isSelect: boolean, customId: string) =>
      ({
        type: 3,
        customId,
        createdTimestamp: Date.now(),
        guild: null,
        inGuild: () => false,
        isAnySelectMenu: () => isSelect,
      }) as never
    listener.run(interaction(true, 'pick:one'))
    listener.run(interaction(false, 'button-like'))
    const points = await collect('discord_select_menu_interaction_total')
    const selects = points.get('discord_select_menu_interaction_total') ?? []
    expect(selects).toHaveLength(1)
    expect(selects[0]?.attributes.custom_id).toBe('pick')
    expect(labelKeys(selects[0]?.attributes ?? {})).toEqual([
      'custom_id',
      'scope',
      'shard_id',
    ])
  })

  it('labels packets without dispatch type by opcode', async () => {
    const listener = new GatewayEventMetricsListener(
      pieceContext('gatewayEventMetrics'),
      {},
    )
    listener.run({ op: 10 } as never, 0 as never)
    listener.run({} as never, 1 as never)
    listener.run({ t: 'MESSAGE_CREATE' } as never, 0 as never)
    const points = await collect('discord_gateway_events_total')
    const types = new Set(
      (points.get('discord_gateway_events_total') ?? []).map(
        (point) => point.attributes.type,
      ),
    )
    expect(types).toEqual(new Set(['op_10', 'op_unknown', 'MESSAGE_CREATE']))
  })
})

describe('task metrics', () => {
  it('pins the counter schema and separates deferrals from errors', async () => {
    const success = new TaskSuccessMetricsListener(
      pieceContext('taskSuccessMetrics'),
      {},
    )
    const error = new TaskErrorMetricsListener(
      pieceContext('taskErrorMetrics'),
      {},
    )
    success.run(
      { name: 'metricsCollection' } as never,
      undefined as never,
      undefined as never,
      1500 as never,
    )
    error.run(
      new Error('boom') as never,
      { name: 'entitlementRefresh' } as never,
      undefined as never,
    )
    error.run(
      new TaskDeferred('not the owner') as never,
      { name: 'entitlementRefresh' } as never,
      undefined as never,
    )
    const points = await collect(
      'discord_tasks_total',
      'discord_task_duration_seconds',
    )
    const counts = (points.get('discord_tasks_total') ?? []).map(
      (point) => point.attributes,
    )
    expect(counts).toEqual(
      expect.arrayContaining([
        { task: 'metricsCollection', status: 'success' },
        { task: 'entitlementRefresh', status: 'error' },
        { task: 'entitlementRefresh', status: 'deferred' },
      ]),
    )
    for (const point of points.get('discord_task_duration_seconds') ?? [])
      expect(labelKeys(point.attributes)).toEqual(['status', 'task'])
  })
})
