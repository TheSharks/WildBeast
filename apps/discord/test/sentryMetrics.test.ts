import { EventEmitter } from 'node:events'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { container, ListenerStore } from '@sapphire/framework'
import * as Sentry from '@sentry/node'
import { silentLogger } from '@thesharks/test-utils'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
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
        global: false,
      },
    })
  })
})
