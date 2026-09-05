import { container } from '@sapphire/framework'
import { silentLogger } from '@thesharks/test-utils'
import { ApplicationCommandOptionType } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  selectResults: [] as unknown[],
  updateResults: [] as unknown[],
  findFirstResults: [] as unknown[],
  findManyResults: [] as unknown[],
  selectDistinctResults: [] as unknown[],
  dbSelectResults: [] as unknown[],
  updateCalls: [] as unknown[],
  order: [] as string[],
  create: vi.fn(
    async (_client: unknown, _guild: string, name: string) =>
      900n + BigInt(name.length % 10),
  ),
  delete: vi.fn(async () => undefined),
  promoAdd: vi.fn(),
  execute: vi.fn(async () => undefined),
}))

vi.mock('@thesharks/drizzle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@thesharks/drizzle')>()
  const tx = {
    execute: mocks.execute,
    select: vi.fn(() => {
      const result = mocks.selectResults.shift()
      return { from: () => ({ where: async () => result }) }
    }),
    update: vi.fn(() => ({
      set: (values: unknown) => {
        mocks.updateCalls.push(values)
        mocks.order.push('update')
        return {
          where: () => ({
            returning: async () => mocks.updateResults.shift() ?? [],
          }),
        }
      },
    })),
  }
  return {
    ...actual,
    db: {
      transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(tx),
      select: vi.fn(() => ({
        from: () => {
          // One entry per select().from(); guild-row query chains .where().limit(), watermark awaits directly.
          const rows =
            mocks.dbSelectResults.length > 0
              ? (mocks.dbSelectResults.shift() as unknown[])
              : [{ id: 1n }]
          const builder = Promise.resolve(rows) as Promise<unknown[]> & {
            where: () => { limit: () => Promise<unknown[]> }
          }
          builder.where = () => ({ limit: async () => rows })
          return builder
        },
      })),
      query: {
        tags: {
          findFirst: async () => {
            const next = mocks.findFirstResults.shift()
            if (next instanceof Error) throw next
            return next
          },
          findMany: async () => mocks.findManyResults.shift() ?? [],
        },
      },
      selectDistinct: () => ({
        from: () => ({
          where: async () => mocks.selectDistinctResults.shift() ?? [],
        }),
      }),
      update: () => ({
        set: (values: unknown) => {
          mocks.updateCalls.push(values)
          mocks.order.push('update')
          return {
            // Recreate path awaits `where(...)` directly (no returning).
            where: Object.assign(async () => undefined, {
              returning: async () => mocks.updateResults.shift() ?? [],
            }),
          }
        },
      }),
    },
  }
})

vi.mock('../src/utils/guildTagCommands.mjs', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../src/utils/guildTagCommands.mjs')>()
  return {
    ...actual,
    createGuildTagCommand: mocks.create,
    deleteGuildTagCommand: mocks.delete,
    promotionsCounter: { add: mocks.promoAdd },
  }
})

import {
  isDevGuild,
  TAG_ARGS_DESCRIPTION_FALLBACK,
  TagCommands,
} from '../src/utils/tagService.mjs'

const client = {} as never
const NO_RESERVED = new Set<string>()

function tagRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    guildId: 10n,
    name: 'hello',
    content: 'hi',
    authorId: 5n,
    commandId: null,
    commandDescription: null,
    promotedBy: null,
    promotedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  container.logger = silentLogger
  mocks.selectResults.length = 0
  mocks.updateResults.length = 0
  mocks.findFirstResults.length = 0
  mocks.findManyResults.length = 0
  mocks.selectDistinctResults.length = 0
  mocks.dbSelectResults.length = 0
  mocks.updateCalls.length = 0
  mocks.order.length = 0
  mocks.create.mockClear()
  mocks.delete.mockClear()
  mocks.promoAdd.mockClear()
  mocks.execute.mockClear()
  mocks.create.mockImplementation(
    async (_client: unknown, _guild: string, name: string) =>
      900n + BigInt(name.length % 10),
  )
  mocks.delete.mockImplementation(async () => undefined)
  delete process.env.WILDBEAST_DEV_GUILD_ID
})

describe('promote', () => {
  it('rejects invalid and reserved names without touching the DB or REST', async () => {
    await expect(
      TagCommands.promote(client, {
        guildId: '10',
        tagId: 1,
        tagName: 'has space',
        userId: '5',
        description: 'd',
        argsDescription: 'a',
        limit: 2,
        reserved: NO_RESERVED,
      }),
    ).resolves.toBe('invalidName')
    await expect(
      TagCommands.promote(client, {
        guildId: '10',
        tagId: 1,
        tagName: 'Ping',
        userId: '5',
        description: 'd',
        argsDescription: 'a',
        limit: 2,
        reserved: new Set(['ping']),
      }),
    ).resolves.toBe('reserved')
    expect(mocks.execute).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('returns limit without REST when the cap is already held', async () => {
    mocks.selectResults.push([{ value: 2 }])
    await expect(
      TagCommands.promote(client, {
        guildId: '10',
        tagId: 1,
        tagName: 'hello',
        userId: '5',
        description: 'd',
        argsDescription: 'a',
        limit: 2,
        reserved: NO_RESERVED,
      }),
    ).resolves.toBe('limit')
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.promoAdd).not.toHaveBeenCalled()
  })

  it('returns alreadyPromoted when a concurrent promote claimed the row', async () => {
    mocks.selectResults.push([{ value: 0 }], [])
    await expect(
      TagCommands.promote(client, {
        guildId: '10',
        tagId: 1,
        tagName: 'hello',
        userId: '5',
        description: 'd',
        argsDescription: 'a',
        limit: 2,
        reserved: NO_RESERVED,
      }),
    ).resolves.toBe('alreadyPromoted')
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('promotes on the happy path with lock, REST, conditional update, and metric', async () => {
    mocks.selectResults.push([{ value: 0 }], [{ id: 1 }])
    mocks.create.mockResolvedValueOnce(123n)
    mocks.updateResults.push([{ id: 1 }])
    await expect(
      TagCommands.promote(client, {
        guildId: '10',
        tagId: 1,
        tagName: 'Hello',
        userId: '5',
        description: 'Say hi',
        argsDescription: 'args',
        limit: 2,
        reserved: NO_RESERVED,
      }),
    ).resolves.toBe('promoted')
    expect(mocks.execute).toHaveBeenCalledOnce()
    expect(mocks.create).toHaveBeenCalledWith(
      client,
      '10',
      'hello',
      'Say hi',
      'args',
    )
    expect(mocks.updateCalls[0]).toMatchObject({
      commandId: 123n,
      commandDescription: 'Say hi',
      promotedBy: 5n,
    })
    expect(mocks.promoAdd).toHaveBeenCalledWith(1, {
      action: 'promote',
      trigger: 'command',
    })
  })

  it('loses the race when the conditional update affects zero rows', async () => {
    mocks.selectResults.push([{ value: 0 }], [{ id: 1 }])
    mocks.create.mockResolvedValueOnce(123n)
    mocks.updateResults.push([])
    await expect(
      TagCommands.promote(client, {
        guildId: '10',
        tagId: 1,
        tagName: 'hello',
        userId: '5',
        description: 'd',
        argsDescription: 'a',
        limit: 2,
        reserved: NO_RESERVED,
      }),
    ).resolves.toBe('alreadyPromoted')
    expect(mocks.promoAdd).not.toHaveBeenCalled()
  })

  it('compensates the just-created command when the race is lost after REST', async () => {
    // Concurrent delete zeroed the update; the created command must not leak.
    mocks.selectResults.push([{ value: 0 }], [{ id: 1 }])
    mocks.create.mockResolvedValueOnce(777n)
    mocks.updateResults.push([])
    await expect(
      TagCommands.promote(client, {
        guildId: '10',
        tagId: 1,
        tagName: 'hello',
        userId: '5',
        description: 'd',
        argsDescription: 'a',
        limit: 2,
        reserved: NO_RESERVED,
      }),
    ).resolves.toBe('alreadyPromoted')
    expect(mocks.delete).toHaveBeenCalledWith(client, '10', 777n)
    expect(mocks.promoAdd).not.toHaveBeenCalled()
  })

  it('still returns alreadyPromoted when compensation delete fails', async () => {
    mocks.selectResults.push([{ value: 0 }], [{ id: 1 }])
    mocks.create.mockResolvedValueOnce(888n)
    mocks.updateResults.push([])
    mocks.delete.mockRejectedValueOnce(new Error('delete down'))
    await expect(
      TagCommands.promote(client, {
        guildId: '10',
        tagId: 1,
        tagName: 'hello',
        userId: '5',
        description: 'd',
        argsDescription: 'a',
        limit: 2,
        reserved: NO_RESERVED,
      }),
    ).resolves.toBe('alreadyPromoted')
  })

  it('propagates REST failures so the transaction rolls back', async () => {
    mocks.selectResults.push([{ value: 0 }], [{ id: 1 }])
    mocks.create.mockRejectedValueOnce(new Error('discord down'))
    await expect(
      TagCommands.promote(client, {
        guildId: '10',
        tagId: 1,
        tagName: 'hello',
        userId: '5',
        description: 'd',
        argsDescription: 'a',
        limit: 2,
        reserved: NO_RESERVED,
      }),
    ).rejects.toThrow('discord down')
  })
})

describe('demote', () => {
  it('returns notPromoted without REST when the row is already clear', async () => {
    mocks.selectResults.push([{ commandId: null }])
    await expect(
      TagCommands.demote(client, {
        guildId: '10',
        tagId: 1,
        expectedCommandId: 100n,
      }),
    ).resolves.toBe('notPromoted')
    expect(mocks.delete).not.toHaveBeenCalled()
  })

  it('never wipes a new promotion with a stale expected id', async () => {
    mocks.selectResults.push([{ commandId: 101n }])
    await expect(
      TagCommands.demote(client, {
        guildId: '10',
        tagId: 1,
        expectedCommandId: 100n,
      }),
    ).resolves.toBe('notPromoted')
    expect(mocks.delete).not.toHaveBeenCalled()
  })

  it('deletes Discord-first, then clears, then counts the metric', async () => {
    mocks.selectResults.push([{ commandId: 100n }])
    mocks.updateResults.push([{ id: 1 }])
    mocks.delete.mockImplementationOnce(async () => {
      mocks.order.push('delete')
    })
    await expect(
      TagCommands.demote(client, {
        guildId: '10',
        tagId: 1,
        expectedCommandId: 100n,
      }),
    ).resolves.toBe('demoted')
    expect(mocks.order).toEqual(['delete', 'update'])
    expect(mocks.updateCalls[0]).toMatchObject({
      commandId: null,
      commandDescription: null,
      promotedBy: null,
      promotedAt: null,
    })
    expect(mocks.promoAdd).toHaveBeenCalledWith(1, {
      action: 'demote',
      trigger: 'command',
    })
  })

  it('propagates Discord failures without clearing the row', async () => {
    mocks.selectResults.push([{ commandId: 100n }])
    mocks.delete.mockRejectedValueOnce(new Error('discord down'))
    await expect(
      TagCommands.demote(client, {
        guildId: '10',
        tagId: 1,
        expectedCommandId: 100n,
      }),
    ).rejects.toThrow('discord down')
    expect(mocks.updateCalls).toHaveLength(0)
  })
})

describe('resolve', () => {
  it('hits on a same-guild row', async () => {
    const row = tagRow({ commandId: 100n })
    mocks.findFirstResults.push(row)
    await expect(
      TagCommands.resolve({ commandId: '100', guildId: '10' }),
    ).resolves.toEqual({ kind: 'hit', tag: row })
  })

  it('misses when the command belongs to another guild', async () => {
    mocks.findFirstResults.push(tagRow({ commandId: 100n, guildId: 99n }))
    mocks.findFirstResults.push(tagRow({ commandId: 100n, guildId: 99n }))
    await expect(
      TagCommands.resolve({ commandId: '100', guildId: '10' }),
    ).resolves.toEqual({ kind: 'miss' })
  })

  it('covers in-flight promotes with one re-read before missing', async () => {
    const row = tagRow({ commandId: 100n })
    mocks.findFirstResults.push(undefined, row)
    await expect(
      TagCommands.resolve({ commandId: '100', guildId: '10' }),
    ).resolves.toEqual({ kind: 'hit', tag: row })
  })

  it('misses on re-read failure instead of throwing', async () => {
    mocks.findFirstResults.push(undefined, new Error('db down'))
    await expect(
      TagCommands.resolve({ commandId: '100', guildId: '10' }),
    ).resolves.toEqual({ kind: 'miss' })
  })
})

describe('reconcileGuild', () => {
  const tagShape = (id: string) => ({
    id,
    options: [{ name: 'args', type: ApplicationCommandOptionType.String }],
  })
  function fetchClient(entries: Array<{ id: string; shape: unknown }>) {
    return {
      application: {
        commands: {
          fetch: async () =>
            new Map(entries.map((e) => [e.id, e.shape as { id: string }])),
        },
      },
    } as never
  }

  it('deletes only unclaimed tag-shaped orphans and re-reads in-flight claims', async () => {
    mocks.findManyResults.push([tagRow({ id: 1, commandId: 100n })])
    // Orphan 101 (gone) -> delete; in-flight 104 (same guild) -> keep.
    mocks.findFirstResults.push(undefined, tagRow({ commandId: 104n }))
    const clientWithCommands = fetchClient([
      { id: '100', shape: tagShape('100') },
      { id: '101', shape: tagShape('101') },
      {
        id: '102',
        shape: {
          id: '102',
          options: [
            { name: 'query', type: ApplicationCommandOptionType.String },
          ],
        },
      },
      { id: '104', shape: tagShape('104') },
    ])
    const stats = await TagCommands.reconcileGuild(clientWithCommands, 10n, {
      cap: 5,
      reserved: NO_RESERVED,
      argsDescription: TAG_ARGS_DESCRIPTION_FALLBACK,
    })
    expect(stats.orphans).toBe(1)
    expect(mocks.delete).toHaveBeenCalledTimes(1)
    expect(mocks.delete).toHaveBeenCalledWith(clientWithCommands, '10', 101n)
    expect(mocks.promoAdd).toHaveBeenCalledWith(1, {
      action: 'demote',
      trigger: 'orphanCleanup',
    })
  })

  it('demotes over-cap promotions newest-first', async () => {
    const at = (min: number) => new Date(Date.UTC(2026, 0, 1, 0, min))
    mocks.findManyResults.push([
      tagRow({ id: 1, name: 'old', commandId: 11n, promotedAt: at(10) }),
      tagRow({ id: 2, name: 'mid', commandId: 22n, promotedAt: at(20) }),
      tagRow({ id: 3, name: 'new', commandId: 33n, promotedAt: at(30) }),
    ])
    // Fresh mirror (guild has a row) proves the cap; demotion proceeds.
    mocks.dbSelectResults.push([{ id: 1n }])
    const clientWithCommands = fetchClient([
      { id: '11', shape: tagShape('11') },
      { id: '22', shape: tagShape('22') },
      { id: '33', shape: tagShape('33') },
    ])
    const stats = await TagCommands.reconcileGuild(clientWithCommands, 10n, {
      cap: 2,
      reserved: NO_RESERVED,
    })
    expect(stats.demoted).toBe(1)
    expect(mocks.delete).toHaveBeenCalledTimes(1)
    expect(mocks.delete).toHaveBeenCalledWith(clientWithCommands, '10', 33n)
    expect(mocks.promoAdd).toHaveBeenCalledWith(1, {
      action: 'demote',
      trigger: 'reconcile',
    })
  })

  it('defers over-cap demotion when the mirror is empty (never synced)', async () => {
    const at = (min: number) => new Date(Date.UTC(2026, 0, 1, 0, min))
    mocks.findManyResults.push([
      tagRow({ id: 1, name: 'old', commandId: 11n, promotedAt: at(10) }),
      tagRow({ id: 2, name: 'new', commandId: 22n, promotedAt: at(20) }),
    ])
    // No guild row + empty global mirror: payer grant may be unmirrored, keep commands.
    mocks.dbSelectResults.push([], [])
    const clientWithCommands = fetchClient([
      { id: '11', shape: tagShape('11') },
      { id: '22', shape: tagShape('22') },
    ])
    const stats = await TagCommands.reconcileGuild(clientWithCommands, 10n, {
      cap: 1,
      reserved: NO_RESERVED,
    })
    expect(stats.demoted).toBe(0)
    expect(mocks.delete).not.toHaveBeenCalled()
  })

  it('defers over-cap demotion when the mirror watermark is stale', async () => {
    const at = (min: number) => new Date(Date.UTC(2026, 0, 1, 0, min))
    mocks.findManyResults.push([
      tagRow({ id: 1, name: 'old', commandId: 11n, promotedAt: at(10) }),
      tagRow({ id: 2, name: 'new', commandId: 22n, promotedAt: at(20) }),
    ])
    // No guild row + stale global watermark: don't demote on stale data.
    mocks.dbSelectResults.push(
      [],
      [{ maxUpdatedAt: new Date(Date.UTC(2020, 0, 1)) }],
    )
    const clientWithCommands = fetchClient([
      { id: '11', shape: tagShape('11') },
      { id: '22', shape: tagShape('22') },
    ])
    const stats = await TagCommands.reconcileGuild(clientWithCommands, 10n, {
      cap: 1,
      reserved: NO_RESERVED,
    })
    expect(stats.demoted).toBe(0)
    expect(mocks.delete).not.toHaveBeenCalled()
  })

  it('demotes when the mirror is fresh and the guild is genuinely free', async () => {
    const at = (min: number) => new Date(Date.UTC(2026, 0, 1, 0, min))
    mocks.findManyResults.push([
      tagRow({ id: 1, name: 'old', commandId: 11n, promotedAt: at(10) }),
      tagRow({ id: 2, name: 'new', commandId: 22n, promotedAt: at(20) }),
    ])
    // No guild row but fresh global mirror proves absence means free.
    mocks.dbSelectResults.push([], [{ maxUpdatedAt: new Date() }])
    const clientWithCommands = fetchClient([
      { id: '11', shape: tagShape('11') },
      { id: '22', shape: tagShape('22') },
    ])
    const stats = await TagCommands.reconcileGuild(clientWithCommands, 10n, {
      cap: 1,
      reserved: NO_RESERVED,
    })
    expect(stats.demoted).toBe(1)
    expect(mocks.delete).toHaveBeenCalledWith(clientWithCommands, '10', 22n)
  })

  it('recreates missing commands verbatim and demotes newly-reserved names', async () => {
    mocks.findManyResults.push([
      tagRow({
        id: 1,
        name: 'hello',
        commandId: 44n,
        commandDescription: 'Say hi',
      }),
      tagRow({ id: 2, name: 'ping', commandId: 55n }),
    ])
    const clientWithCommands = fetchClient([])
    mocks.create.mockResolvedValueOnce(66n)
    const stats = await TagCommands.reconcileGuild(clientWithCommands, 10n, {
      cap: 5,
      reserved: new Set(['ping']),
    })
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.create).toHaveBeenCalledWith(
      clientWithCommands,
      '10',
      'hello',
      'Say hi',
      TAG_ARGS_DESCRIPTION_FALLBACK,
    )
    expect(mocks.promoAdd).toHaveBeenCalledWith(1, {
      action: 'promote',
      trigger: 'reconcile',
    })
    // Reserved row demoted instead of recreated.
    expect(mocks.promoAdd).toHaveBeenCalledWith(1, {
      action: 'demote',
      trigger: 'reconcile',
    })
    expect(stats).toEqual({ demoted: 1, recreated: 1, orphans: 0 })
  })
})

describe('reconcileAll', () => {
  function fetchClient(impl: (guildId: string) => Promise<unknown>) {
    return {
      application: { commands: { fetch: impl } },
    } as never
  }

  it('skips the dev guild', () => {
    process.env.WILDBEAST_DEV_GUILD_ID = '999'
    expect(isDevGuild(999n)).toBe(true)
    expect(isDevGuild(1n)).toBe(false)
  })

  it('sweeps listed guilds while skipping the dev guild', async () => {
    process.env.WILDBEAST_DEV_GUILD_ID = '999'
    const seen: string[] = []
    const c = fetchClient(async (opts: unknown) => {
      seen.push((opts as { guildId: string }).guildId)
      return new Map()
    })
    mocks.findManyResults.push([], [])
    const stats = await TagCommands.reconcileAll(c, {
      listGuilds: async () => [999n, 1n],
      cap: 5,
      reserved: NO_RESERVED,
    })
    expect(seen).toEqual(['1'])
    expect(stats).toEqual({ guilds: 2, failures: 0 })
  })

  it('isolates per-guild failures and reports them', async () => {
    const c = fetchClient(async (opts: unknown) => {
      if ((opts as { guildId: string }).guildId === '1') {
        throw new Error('discord down')
      }
      return new Map()
    })
    mocks.findManyResults.push([], [])
    const stats = await TagCommands.reconcileAll(c, {
      listGuilds: async () => [1n, 2n],
      cap: 5,
      reserved: NO_RESERVED,
    })
    expect(stats).toEqual({ guilds: 2, failures: 1 })
  })
})

describe('deleteCommand', () => {
  it('counts the given trigger', async () => {
    await TagCommands.deleteCommand(client, '10', 100n, 'tagDelete')
    expect(mocks.delete).toHaveBeenCalledWith(client, '10', 100n)
    expect(mocks.promoAdd).toHaveBeenCalledWith(1, {
      action: 'demote',
      trigger: 'tagDelete',
    })
  })
})
