import { EventEmitter } from 'node:events'
import { CommandStore, container } from '@sapphire/framework'
import { silentLogger } from '@thesharks/test-utils'
import { Collection } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type OperatorCommandGateway,
  OperatorCommands,
  parseGuildList,
} from '../src/operators/service.mjs'
import { installFakeApp, loaderContext } from './helpers.mjs'

vi.mock('@sapphire/plugin-i18next', async () => {
  const actual = await vi.importActual('@sapphire/plugin-i18next')
  return {
    ...actual,
    resolveKey: vi.fn(async (_interaction: unknown, key: string) => key),
    applyLocalizedBuilder: (
      builder: {
        setName(name: string): unknown
        setDescription(d: string): unknown
      },
      name: string,
      description: string,
    ) => {
      builder.setName(name.split(':').pop()!.toLowerCase())
      builder.setDescription(description)
      return builder
    },
  }
})
const { FlagsCommand } = await import('../src/commands/flags.mjs')

container.client = Object.assign(new EventEmitter(), {
  options: {},
  guilds: { cache: new Collection() },
}) as never
container.logger = silentLogger

function gateway() {
  const commands = new Map<string, { guildId: bigint; data: unknown }>()
  let next = 100n
  const fake: OperatorCommandGateway & {
    commands: typeof commands
    lost: Set<bigint>
  } = {
    commands,
    lost: new Set(),
    create: vi.fn(async (guildId, data) => {
      const id = next++
      commands.set(id.toString(), { guildId, data })
      return id
    }),
    update: vi.fn(async (_guildId, id, data) => {
      if (fake.lost.has(id)) return false
      const entry = commands.get(id.toString())
      if (entry) entry.data = data
      return true
    }),
    delete: vi.fn(async (_guildId, id) => {
      commands.delete(id.toString())
    }),
  }
  return fake
}

function placements() {
  const rows = new Map<string, bigint>()
  return {
    rows,
    placements: vi.fn(async () =>
      [...rows].map(([key, commandId]) => ({
        name: key.split(':')[0]!,
        guildId: BigInt(key.split(':')[1]!),
        commandId,
      })),
    ),
    record: vi.fn(async (name: string, guildId: bigint, commandId: bigint) => {
      rows.set(`${name}:${guildId}`, commandId)
    }),
    forget: vi.fn(async (name: string, guildId: bigint) => {
      rows.delete(`${name}:${guildId}`)
    }),
  }
}

const definition = {
  name: 'flags',
  data: { name: 'flags', description: 'x' } as never,
}
const signal = () => new AbortController().signal

describe('operator command placement', () => {
  it('removes persisted commands when their definitions disappear, retrying failed deletes', async () => {
    const remote = gateway()
    const store = placements()
    let definitions = [definition]
    const service = new OperatorCommands(
      () => definitions,
      async () => new Set([1n]),
      remote,
      store,
    )
    await service.reconcile(signal())
    definitions = []
    vi.mocked(remote.delete).mockRejectedValueOnce(new Error('unavailable'))
    expect((await service.reconcile(signal())).failures).toHaveLength(1)
    expect(store.rows.size).toBe(1)
    expect(await service.reconcile(signal())).toMatchObject({
      removed: 1,
      failures: [],
    })
    expect(store.rows.size).toBe(0)
    expect(remote.commands.size).toBe(0)
  })

  it('creates in listed guilds, updates known placements and removes from unlisted guilds', async () => {
    const remote = gateway()
    const store = placements()
    let guilds = new Set([1n, 2n])
    const service = new OperatorCommands(
      () => [definition],
      async () => guilds,
      remote,
      store,
    )
    expect(await service.reconcile(signal())).toMatchObject({
      guilds: 2,
      created: 2,
      updated: 0,
      removed: 0,
      failures: [],
    })
    expect(store.rows.size).toBe(2)
    guilds = new Set([2n, 3n])
    expect(await service.reconcile(signal())).toMatchObject({
      created: 1,
      updated: 1,
      removed: 1,
    })
    expect([...store.rows.keys()].sort()).toEqual(['flags:2', 'flags:3'])
    expect(remote.commands.size).toBe(2)
    expect(service.names()).toEqual(new Set(['flags']))
  })

  it('recreates a placement Discord no longer knows and isolates per-guild failures', async () => {
    const remote = gateway()
    const store = placements()
    const service = new OperatorCommands(
      () => [definition],
      async () => new Set([1n, 2n]),
      remote,
      store,
    )
    await service.reconcile(signal())
    remote.lost.add(store.rows.get('flags:1')!)
    remote.create.mockRejectedValueOnce(new Error('Missing Access'))
    const result = await service.reconcile(signal())
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0]).toMatchObject({ name: 'flags', guildId: 1n })
    expect(result.updated).toBe(1)
    const retried = await service.reconcile(signal())
    expect(retried).toMatchObject({ created: 1, updated: 1, failures: [] })
    expect(store.rows.get('flags:1')).not.toBe([...remote.lost][0])
  })

  it('parses guild lists leniently', () => {
    expect(parseGuildList(' 1, 2,,x, 3 ')).toEqual(new Set([1n, 2n, 3n]))
    expect(parseGuildList(undefined)).toEqual(new Set())
  })
})

describe('operator-scoped commands', () => {
  let command: InstanceType<typeof FlagsCommand>
  beforeEach(async () => {
    await installFakeApp({ config: { ownerIds: new Set([900n]) } })
    command = new FlagsCommand(loaderContext('flags', new CommandStore()), {})
  })

  it('captures the definition with admin-only permissions instead of registering it', async () => {
    const registry = {
      registerChatInputCommand: vi.fn(),
      registerContextMenuCommand: vi.fn(),
    }
    await command.registerApplicationCommands(registry as never)
    expect(registry.registerChatInputCommand).not.toHaveBeenCalled()
    expect(command.scope).toBe('operator')
    expect(command.operatorCommand).toMatchObject({
      name: 'flags',
      default_member_permissions: '0',
    })
    expect(
      (command.operatorCommand as { options: unknown[] }).options,
    ).toHaveLength(2)
    expect(
      command.preconditions.entries.some(
        (entry) => 'name' in entry && entry.name === 'OwnerOnly',
      ),
    ).toBe(true)
  })

  it('answers autocomplete only for owners', async () => {
    const interaction = (userId: string) => ({
      user: { id: userId },
      guildId: '500',
      guild: null,
      entitlements: new Map(),
      isChatInputCommand: () => false,
      isAutocomplete: () => true,
      options: {
        getSubcommand: () => 'inspect',
        getFocused: () => 'commands.tag',
      },
      respond: vi.fn(async () => undefined),
    })
    const owner = interaction('900')
    await command.autocompleteRun(owner as never)
    expect(owner.respond).toHaveBeenCalledWith(
      expect.arrayContaining([
        { name: 'features.commands.tag', value: 'features.commands.tag' },
      ]),
    )
    const stranger = interaction('901')
    await command.autocompleteRun(stranger as never)
    expect(stranger.respond).toHaveBeenCalledWith([])
  })
})
