import { container } from '@sapphire/framework'
import { silentLogger } from '@thesharks/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { FeatureFlags } from '../src/features/flags.mjs'
import type { Grant } from '../src/premium/model.mjs'
import {
  type CompositionOptions,
  composeApplication,
} from '../src/runtime/composition.mjs'
import type { AppConfig } from '../src/runtime/config.mjs'

const config: AppConfig = {
  environment: 'test',
  development: false,
  trace: false,
  discordToken: 'token',
  databaseUrl: 'postgresql://unused',
  redis: { host: 'localhost', port: 6379 },
  premiumSkus: new Map([[10n, 'premium']]),
  premiumCatalog: new Map(),
  devGuildId: null,
  ownerIds: new Set(),
  flags: { cacheTtlMs: 0 },
  shardIds: [0],
  sessionKeyPrefix: 'test',
  identifyKeyPrefix: 'test:identify',
  schedules: { entitlementStaleAfterMs: 60_000 },
  drainTimeoutMs: 1_000,
}

function harness(overrides: Partial<CompositionOptions> = {}) {
  const events: string[] = []
  const stored = new Map<string, string>()
  const redis = {
    connect: vi.fn(async () => {
      events.push('redis:connect')
    }),
    quit: vi.fn(async () => {
      events.push('redis:quit')
    }),
    disconnect: vi.fn(),
    get: async (key: string) => stored.get(key) ?? null,
    set: async (key: string, value: string) => {
      stored.set(key, value)
    },
    del: async (key: string) => {
      stored.delete(key)
    },
  }
  let schemaRows = 1
  const database = {
    db: {
      execute: vi.fn(async () => {
        events.push('database:ping')
        return { rows: Array.from({ length: schemaRows }, () => ({})) }
      }),
    },
    close: vi.fn(async () => {
      events.push('database:close')
    }),
    withSession: vi.fn(),
  }
  const shards = new Map<number, unknown>([[0, {}]])
  let ready = false
  const client = {
    ws: { shards, _ws: { options: {}, destroy: vi.fn() }, destroyed: false },
    isReady: () => ready,
    login: vi.fn(async () => {
      events.push('gateway:login')
      ready = true
    }),
    destroy: vi.fn(async () => {
      events.push('gateway:destroy')
      ready = false
    }),
  }
  const entitlementSource = {
    fetchAll: vi.fn(async (): Promise<Grant[]> => {
      events.push('entitlements:fetch')
      return []
    }),
  }
  const entitlementRepository = {
    state: async () => ({ revision: 0n, completedAt: null }),
    forOwner: vi.fn(),
    write: vi.fn(),
    replace: vi.fn(async () => {
      events.push('entitlements:replace')
      return true
    }),
  }
  const flags = new FeatureFlags({ cacheTtlMs: 0 })
  const composed = composeApplication(config, {
    logger: silentLogger,
    telemetry: {
      shutdown: async () => {
        events.push('telemetry:shutdown')
      },
    },
    openDatabase: () => {
      events.push('database:open')
      return database as never
    },
    openRedis: () => redis as never,
    createClient: () => {
      events.push('gateway:create')
      return client as never
    },
    entitlementSource,
    entitlementRepository,
    flags,
    ...overrides,
  })
  return {
    ...composed,
    events,
    redis,
    database,
    client,
    shards,
    stored,
    entitlementSource,
    entitlementRepository,
    setSchemaRows: (rows: number) => {
      schemaRows = rows
    },
  }
}

describe('replacement application composition', () => {
  it('opens resources in dependency order and closes them in reverse', async () => {
    const app = harness()
    await app.runtime.start()
    expect(app.runtime.phase).toBe('ready')
    expect(container.app).toBe(app.services)
    expect(app.events).toEqual([
      'database:open',
      'database:ping',
      'redis:connect',
      'gateway:create',
      'gateway:login',
    ])
    app.events.length = 0
    await app.runtime.stop('shutdown')
    expect(app.events).toEqual([
      'gateway:destroy',
      'redis:quit',
      'database:close',
      'telemetry:shutdown',
    ])
  })

  it('unwinds the database and redis when login fails, and never publishes readiness', async () => {
    const app = harness()
    app.client.login.mockImplementationOnce(async () => {
      app.events.push('gateway:login')
      throw new Error('invalid token')
    })
    await expect(app.runtime.start()).rejects.toThrow('startup failed')
    expect(app.runtime.phase).toBe('failed')
    expect(app.events).toEqual([
      'database:open',
      'database:ping',
      'redis:connect',
      'gateway:create',
      'gateway:login',
      'gateway:destroy',
      'redis:quit',
      'database:close',
      'telemetry:shutdown',
    ])
    await expect(app.services.work.run(async () => 1)).rejects.toThrow(
      'not accepting',
    )
  })

  it('refuses to start against a database that predates the replacement schema', async () => {
    const app = harness()
    app.setSchemaRows(0)
    await expect(app.runtime.start()).rejects.toSatisfy(
      (error: AggregateError) =>
        error.errors[0] instanceof Error &&
        error.errors[0].message.includes('run migrations'),
    )
    expect(app.database.close).toHaveBeenCalledOnce()
    expect(app.redis.connect).not.toHaveBeenCalled()
  })

  it('invalidates persisted sessions on shutdown but keeps them for a handoff', async () => {
    const shutdown = harness()
    await shutdown.runtime.start()
    shutdown.stored.set('test:shard:0:session', '{"sequence":1}')
    // The session store learns the session through discord.js hooks; seed its cache.
    await shutdown.runtime.stop('shutdown')
    expect(shutdown.stored.has('test:shard:0:session')).toBe(false)

    const handoff = harness()
    await handoff.runtime.start()
    handoff.stored.set('test:shard:0:session', '{"sequence":1}')
    await handoff.runtime.stop('handoff')
    expect(handoff.stored.get('test:shard:0:session')).toBe('{"sequence":1}')
    expect(handoff.client.ws._ws.destroy).toHaveBeenCalledWith({
      code: 4200,
      reason: 'Shard ownership handoff',
    })
    expect(handoff.client.destroy).toHaveBeenCalledOnce()
  })

  it('does not close storage while admitted work is still running', async () => {
    const app = harness()
    await app.runtime.start()
    let release!: () => void
    const gate = new Promise<void>((done) => {
      release = done
    })
    const work = app.services.work.run(() => gate)
    const stop = app.runtime.stop('shutdown')
    await new Promise((done) => setTimeout(done, 20))
    expect(app.database.close).not.toHaveBeenCalled()
    release()
    await work
    await stop
    expect(app.database.close).toHaveBeenCalledOnce()
  })
})
