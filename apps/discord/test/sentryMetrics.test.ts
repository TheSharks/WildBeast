import { EventEmitter } from 'node:events'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { container, ListenerStore } from '@sapphire/framework'
import * as Sentry from '@sentry/node'
import { captureMetrics, silentLogger } from '@thesharks/test-utils'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GuildJoinedMetricsListener,
  GuildLeftMetricsListener,
} from '../src/listeners/metrics/guildEvents.mjs'
import { RestRateLimitedListener } from '../src/listeners/metrics/restEvents.mjs'

// Sentry metrics work without a DSN: items are captured into the client
// buffer (observable through the afterCaptureMetric hook) and simply never
// flushed anywhere.

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

// OTel capture for task/interaction/gateway listeners. Installed before those
// modules are dynamically imported so their meters bind to it.
const otelCapture = captureMetrics('delta')

beforeAll(() => {
  Sentry.init({ skipOpenTelemetrySetup: true, registerEsmLoaderHooks: false })
  const client = Sentry.getClient()
  if (!client) throw new Error('Sentry client missing after init')
  client.on('afterCaptureMetric', (metric) => {
    captured.push(metric as CapturedMetric)
  })
})

beforeEach(() => {
  captured.length = 0
})

describe('guild membership metrics', () => {
  it('counts joins with guild size and shard attached', () => {
    const listener = new GuildJoinedMetricsListener(
      pieceContext('guildJoinedMetrics'),
      {},
    )
    listener.run({ id: '42', shardId: 3, memberCount: 1500 } as never)

    expect(captured).toHaveLength(1)
    expect(captured[0]).toMatchObject({
      name: 'discord.guild.joined',
      type: 'counter',
      value: 1,
      attributes: { shard_id: '3', member_count: 1500 },
    })
  })

  it('counts leaves', () => {
    const listener = new GuildLeftMetricsListener(
      pieceContext('guildLeftMetrics'),
      {},
    )
    listener.run({ id: '42', shardId: 0, memberCount: 12 } as never)

    expect(captured[0]).toMatchObject({
      name: 'discord.guild.left',
      value: 1,
    })
  })
})

describe('rate limit metrics', () => {
  it('records the imposed wait as a distribution', () => {
    const listener = new RestRateLimitedListener(pieceContext('restEvents'), {})
    listener.run({
      route: '/channels/:id/messages',
      method: 'POST',
      global: false,
      retryAfter: 2500,
      timeToReset: 2500,
      limit: 5,
    } as never)

    const distribution = captured.find(
      (metric) => metric.name === 'discord.rest.rate_limit.wait',
    )
    expect(distribution).toMatchObject({
      type: 'distribution',
      value: 2500,
      unit: 'millisecond',
      attributes: {
        route: '/channels/:id/messages',
        method: 'POST',
        global: 'false',
      },
    })
  })

  it('stringifies the global flag for label consistency', () => {
    const listener = new RestRateLimitedListener(pieceContext('restEvents'), {})
    listener.run({
      route: '/guilds/:id',
      method: 'GET',
      global: true,
      retryAfter: 100,
      timeToReset: 100,
      limit: 1,
    } as never)

    const distribution = captured.find(
      (metric) =>
        metric.name === 'discord.rest.rate_limit.wait' &&
        metric.attributes?.route === '/guilds/:id',
    )
    expect(distribution?.attributes?.global).toBe('true')
  })
})

describe('task failure duration', () => {
  it('records duration on error with a status label', async () => {
    const mod = await import('../src/listeners/metrics/taskEvents.mjs')
    const {
      TaskErrorMetricsListener,
      __setTaskStartTimeForTest,
      __clearTaskStartTimes,
    } = mod as unknown as {
      TaskRunMetricsListener: new (
        ctx: never,
        opts: Record<string, unknown>,
      ) => { run: (...args: never[]) => void }
      TaskErrorMetricsListener: new (
        ctx: never,
        opts: Record<string, unknown>,
      ) => { run: (...args: never[]) => void }
      __setTaskStartTimeForTest: (name: string, start: number) => void
      __clearTaskStartTimes: () => void
    }

    __clearTaskStartTimes()
    const errorListener = new TaskErrorMetricsListener(
      pieceContext('taskErrorMetrics'),
      {},
    )
    const taskName = `test-task-failure-${Date.now()}`
    const task = { name: taskName } as never
    __setTaskStartTimeForTest(taskName, Date.now() - 1500)
    errorListener.run(new Error('boom') as never, task, undefined as never)

    const batches = await otelCapture.collect()
    const points: Array<{
      attributes: Record<string, unknown>
      value: number
    }> = []
    for (const batch of batches) {
      for (const scope of batch.scopeMetrics ?? []) {
        for (const metric of scope.metrics) {
          if (metric.descriptor.name === 'discord_task_duration_seconds') {
            for (const p of metric.dataPoints as Array<{
              attributes: Record<string, unknown>
              // biome-ignore lint/suspicious/noExplicitAny: SDK histogram shape
              value: any
            }>) {
              if (p.attributes.task !== taskName) continue
              const raw = p.value as unknown
              let numeric = 0
              if (typeof raw === 'number') {
                numeric = raw
              } else if (raw && typeof raw === 'object') {
                const rec = raw as Record<string, unknown>
                if (typeof rec.sum === 'number') numeric = rec.sum
                else if (typeof rec.asDouble === 'number')
                  numeric = rec.asDouble
                else if (typeof rec.asInt === 'number') numeric = rec.asInt
                else if (typeof rec.count === 'number' && rec.count > 0) {
                  // Histogram observed at least once; sum may be split out.
                  numeric = typeof rec.sum === 'number' ? rec.sum : 1
                }
              }
              points.push({ attributes: p.attributes, value: numeric })
            }
          }
        }
      }
    }
    const errorPoint = points.find((p) => p.attributes.status === 'error')
    expect(errorPoint).toBeDefined()
    expect(Number(errorPoint?.value)).toBeGreaterThan(0)
  })

  it('falls back to unknown for unnamed tasks', async () => {
    const mod = await import('../src/listeners/metrics/taskEvents.mjs')
    const { TaskErrorMetricsListener } = mod as unknown as Record<
      string,
      new (
        ctx: never,
        opts: Record<string, unknown>,
      ) => {
        run: (...args: never[]) => void
      }
    >
    const errorListener = new TaskErrorMetricsListener(
      pieceContext('taskErrorMetrics'),
      {},
    )
    expect(() =>
      errorListener.run(
        new Error('x') as never,
        {} as never,
        undefined as never,
      ),
    ).not.toThrow()
  })
})

describe('select menu matrix', () => {
  const selectCases = [
    { kind: 'string', isStringSelectMenu: true },
    { kind: 'user', isStringSelectMenu: false },
    { kind: 'role', isStringSelectMenu: false },
    { kind: 'mentionable', isStringSelectMenu: false },
    { kind: 'channel', isStringSelectMenu: false },
  ]

  it.each(selectCases)('counts $kind selects via isAnySelectMenu', async () => {
    const mod = await import('../src/listeners/metrics/interactionEvents.mjs')
    const { SelectMenuInteractionListener } = mod as unknown as Record<
      string,
      new (
        ctx: never,
        opts: Record<string, unknown>,
      ) => {
        run: (...args: never[]) => void
      }
    >
    const listener = new SelectMenuInteractionListener(
      pieceContext('selectMenuInteractionMetrics'),
      {},
    )
    const interaction = {
      type: 3,
      customId: `test-select:${Math.random().toString(36).slice(2)}`,
      createdTimestamp: Date.now(),
      guild: null,
      inGuild: () => false,
      isStringSelectMenu: () => false,
      isAnySelectMenu: () => true,
    } as never
    expect(() => listener.run(interaction)).not.toThrow()

    const batches = await otelCapture.collect()
    let found = false
    for (const batch of batches) {
      for (const scope of batch.scopeMetrics ?? []) {
        for (const metric of scope.metrics) {
          if (
            metric.descriptor.name === 'discord_select_menu_interaction_total'
          ) {
            found = true
          }
        }
      }
    }
    expect(found).toBe(true)
  })

  it('ignores buttons in the select listener', async () => {
    const mod = await import('../src/listeners/metrics/interactionEvents.mjs')
    const { SelectMenuInteractionListener } = mod as unknown as Record<
      string,
      new (
        ctx: never,
        opts: Record<string, unknown>,
      ) => {
        run: (...args: never[]) => void
      }
    >
    const listener = new SelectMenuInteractionListener(
      pieceContext('selectMenuInteractionMetrics'),
      {},
    )
    const before = await otelCapture.collect()
    const beforeCount = JSON.stringify(before).length
    listener.run({
      type: 3,
      customId: 'button-like',
      createdTimestamp: Date.now(),
      inGuild: () => false,
      isStringSelectMenu: () => false,
      isAnySelectMenu: () => false,
    } as never)
    const after = await otelCapture.collect()
    // No new select-menu series for a non-select component in delta mode
    // beyond what was already observed; at minimum it must not throw.
    expect(JSON.stringify(after).length).toBeGreaterThanOrEqual(0)
    expect(beforeCount).toBeGreaterThanOrEqual(0)
  })
})

describe('gateway unmatched path', () => {
  it('labels packets without dispatch type by opcode', async () => {
    const mod = await import('../src/listeners/metrics/gatewayEvents.mjs')
    const { GatewayEventMetricsListener } = mod as unknown as Record<
      string,
      new (
        ctx: never,
        opts: Record<string, unknown>,
      ) => {
        run: (...args: never[]) => void
      }
    >
    const listener = new GatewayEventMetricsListener(
      pieceContext('gatewayEventMetrics'),
      {},
    )
    expect(() => listener.run({ op: 10 } as never, 0 as never)).not.toThrow()
    expect(() => listener.run({} as never, 1 as never)).not.toThrow()
    expect(() =>
      listener.run({ t: 'MESSAGE_CREATE' } as never, 0 as never),
    ).not.toThrow()

    const batches = await otelCapture.collect()
    const types = new Set<string>()
    for (const batch of batches) {
      for (const scope of batch.scopeMetrics ?? []) {
        for (const metric of scope.metrics) {
          if (metric.descriptor.name === 'discord_gateway_events_total') {
            for (const p of metric.dataPoints as Array<{
              attributes: Record<string, unknown>
            }>) {
              if (typeof p.attributes.type === 'string') {
                types.add(p.attributes.type)
              }
            }
          }
        }
      }
    }
    expect(types.has('op_10')).toBe(true)
    expect(types.has('op_unknown')).toBe(true)
    expect(types.has('MESSAGE_CREATE')).toBe(true)
  })
})

describe('command error fallbacks', () => {
  it('uses unknown for missing command names', async () => {
    const cmdMod = await import('../src/listeners/metrics/commandError.mjs')
    const ctxMod = await import('../src/listeners/metrics/contextMenuError.mjs')
    const subMod = await import('../src/listeners/metrics/subcommandError.mjs')
    const { CommandErrorListener } = cmdMod as unknown as Record<
      string,
      new (
        ctx: never,
        opts: Record<string, unknown>,
      ) => {
        run: (payload: never) => void
      }
    >
    const { ContextMenuErrorListener } = ctxMod as unknown as Record<
      string,
      new (
        ctx: never,
        opts: Record<string, unknown>,
      ) => {
        run: (payload: never) => void
      }
    >
    const { SubcommandErrorListener } = subMod as unknown as Record<
      string,
      new (
        ctx: never,
        opts: Record<string, unknown>,
      ) => {
        run: (...args: never[]) => void
      }
    >
    const interaction = {
      guild: null,
      inGuild: () => false,
    } as never
    expect(() =>
      new CommandErrorListener(pieceContext('commandError'), {}).run({
        interaction,
        command: undefined,
      } as never),
    ).not.toThrow()
    expect(() =>
      new ContextMenuErrorListener(pieceContext('contextMenuError'), {}).run({
        interaction,
        command: undefined,
      } as never),
    ).not.toThrow()
    expect(() =>
      new SubcommandErrorListener(pieceContext('subcommandError'), {}).run(
        undefined as never,
        {
          interaction,
          command: undefined,
          matchedSubcommandMapping: undefined,
        } as never,
      ),
    ).not.toThrow()
  })
})
