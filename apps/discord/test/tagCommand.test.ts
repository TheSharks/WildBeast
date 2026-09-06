import { EventEmitter } from 'node:events'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CommandStore, container } from '@sapphire/framework'
import { silentLogger } from '@thesharks/test-utils'
import { Collection, MessageFlags } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@sapphire/plugin-i18next', async () => {
  const actual = await vi.importActual('@sapphire/plugin-i18next')
  return {
    ...actual,
    resolveKey: vi.fn(
      async (_interaction: unknown, key: string, values?: unknown) =>
        values ? `${key} ${JSON.stringify(values)}` : key,
    ),
    applyLocalizedBuilder: (builder: unknown) => builder,
  }
})

const { TagCommand } = await import('../src/commands/tag.mjs')
const { FeatureFlags } = await import('../src/features/flags.mjs')
const { CommandGates } = await import('../src/features/gates.mjs')
const { Experiments } = await import('../src/features/experiments.mjs')
const { PremiumService } = await import('../src/premium/service.mjs')
const { WorkScope } = await import('../src/runtime/work.mjs')

const fakeClient = Object.assign(new EventEmitter(), {
  options: {},
  guilds: { cache: new Collection() },
})
container.client = fakeClient as never
container.logger = silentLogger

const tag = {
  id: 1,
  guildId: 90001n,
  name: 'Hello',
  content: 'world',
  authorId: 90002n,
  commandId: null as bigint | null,
  commandDescription: null,
  promotedBy: null,
  promotedAt: null,
}

function fakeServices() {
  const flags = new FeatureFlags()
  const premium = new PremiumService(
    { state: vi.fn(), forOwner: vi.fn(), write: vi.fn(), replace: vi.fn() },
    new Map([[123n, 'premium']]),
  )
  const work = new WorkScope()
  work.open()
  return {
    config: {
      devGuildId: null,
      premiumCatalog: new Map([['123', { tier: 'premium', scope: 'guild' }]]),
    },
    work,
    flags,
    gates: new CommandGates(flags, premium),
    experiments: new Experiments(flags),
    premium,
    tags: {
      find: vi.fn(async () => tag),
      list: vi.fn(async () => [tag, { ...tag, name: 'promo', commandId: 5n }]),
      search: vi.fn(async () => ['Hello']),
      suggest: vi.fn(async () => 'Hello'),
      create: vi.fn(),
      edit: vi.fn(),
      remove: vi.fn(),
      promote: vi.fn(),
      demote: vi.fn(),
      intentsFor: vi.fn(async () => [{ id: 7, tagId: 1, name: 'hello' }]),
    },
    tagReconciler: {
      reconcileGuild: vi.fn(async () => ({ failures: [] })),
    },
    commandIds: { hintsFor: vi.fn(async () => []) },
  }
}

function interaction(options: {
  strings?: Record<string, string>
  manage?: boolean
  subcommand?: string
  entitlements?: Array<{ skuId: string; guildId: string | null }>
}) {
  return {
    guildId: '90001',
    guild: null,
    user: { id: '90002', tag: 'user#0' },
    memberPermissions: { has: () => options.manage ?? false },
    entitlements: new Map(
      (options.entitlements ?? []).map((entitlement, index) => [
        String(index),
        {
          id: String(index + 1),
          skuId: entitlement.skuId,
          userId: '90002',
          guildId: entitlement.guildId,
          type: 8,
          deleted: false,
          startsAt: null,
          endsAt: null,
        },
      ]),
    ),
    options: {
      getString: (name: string) => options.strings?.[name] ?? null,
      getUser: () => null,
      getSubcommand: () => options.subcommand ?? null,
      getFocused: () => 'hel',
    },
    replied: false,
    deferred: false,
    isChatInputCommand: () => true,
    isAutocomplete: () => false,
    inGuild: () => true,
    reply: vi.fn(async () => undefined),
    respond: vi.fn(async () => undefined),
  }
}

let services: ReturnType<typeof fakeServices>
let command: InstanceType<typeof TagCommand>

beforeEach(() => {
  services = fakeServices()
  container.app = services as never
  command = new TagCommand(
    {
      name: 'tag',
      path: fileURLToPath(import.meta.url),
      root: dirname(fileURLToPath(import.meta.url)),
      store: new CommandStore(),
    } as never,
    {},
  )
})

const ephemeral = (content: string) => ({
  content,
  flags: MessageFlags.Ephemeral,
  allowedMentions: { parse: [] },
})

describe('replacement /tag command', () => {
  it('maps create outcomes to replies and attaches an upsell at the cap', async () => {
    services.tags.create.mockResolvedValueOnce({ kind: 'limit', limit: 50 })
    const capped = interaction({ strings: { name: 'x', content: 'y' } })
    await command.chatInputCreate(capped as never)
    expect(capped.reply).toHaveBeenCalledWith({
      content: 'commands/tag:limitReached {"limit":50}',
      components: expect.arrayContaining([expect.anything()]),
      flags: MessageFlags.Ephemeral,
    })

    services.tags.create.mockResolvedValueOnce({ kind: 'created', tag })
    const created = interaction({ strings: { name: ' Hello ', content: 'y' } })
    await command.chatInputCreate(created as never)
    expect(services.tags.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        guildId: 90001n,
        userId: 90002n,
        canManageGuild: false,
      }),
      ' Hello ',
      'y',
    )
    expect(created.reply).toHaveBeenCalledWith(
      ephemeral('commands/tag:created {"name":"Hello"}'),
    )
  })

  it('does not upsell a guild that already holds premium', async () => {
    services.tags.create.mockResolvedValueOnce({ kind: 'limit', limit: 500 })
    const capped = interaction({
      strings: { name: 'x', content: 'y' },
      entitlements: [{ skuId: '123', guildId: '90001' }],
    })
    await command.chatInputCreate(capped as never)
    expect(capped.reply).toHaveBeenCalledWith(
      expect.objectContaining({ components: undefined }),
    )
  })

  it('replies to authorization failures from the service', async () => {
    services.tags.edit.mockResolvedValueOnce({ kind: 'forbidden' })
    const edit = interaction({ strings: { name: 'Hello', content: 'z' } })
    await command.chatInputEdit(edit as never)
    expect(edit.reply).toHaveBeenCalledWith(ephemeral('commands/tag:notOwner'))

    services.tags.remove.mockResolvedValueOnce({
      kind: 'deleted',
      tag: { ...tag, commandId: 5n },
    })
    const remove = interaction({ strings: { name: 'Hello' } })
    await command.chatInputDelete(remove as never)
    expect(remove.reply).toHaveBeenCalledWith(
      ephemeral('commands/tag:deleted {"name":"Hello"}'),
    )
    await vi.waitFor(() =>
      expect(services.tagReconciler.reconcileGuild).toHaveBeenCalledWith(
        90001n,
        expect.any(AbortSignal),
      ),
    )
  })

  it('suggests the closest tag when a tag is missing and the experiment says so', async () => {
    services.tags.find.mockResolvedValueOnce(undefined)
    const show = interaction({ strings: { name: 'helo' }, subcommand: 'show' })
    await command.chatInputShow(show as never)
    expect(show.reply).toHaveBeenCalledWith(
      ephemeral(
        'commands/tag:notFoundSuggestion {"name":"helo","suggestion":"Hello"}',
      ),
    )
  })

  it('promotes through durable intent and reports the repair outcome', async () => {
    const denied = interaction({ strings: { name: 'Hello' } })
    await command.chatInputPromote(denied as never)
    expect(denied.reply).toHaveBeenCalledWith(
      ephemeral('commands/tag:promoteMissingPermission'),
    )
    expect(services.tags.promote).not.toHaveBeenCalled()

    services.tags.promote.mockResolvedValueOnce({ kind: 'requested', tag })
    const ok = interaction({ strings: { name: 'Hello' }, manage: true })
    await command.chatInputPromote(ok as never)
    expect(services.tags.promote).toHaveBeenCalledWith(
      expect.objectContaining({ canManageGuild: true }),
      'Hello',
      'commands/tag:defaultCommandDescription {"name":"Hello"}',
      'commands/descriptions:tagOptionArgs',
    )
    expect(ok.reply).toHaveBeenCalledWith(
      ephemeral('commands/tag:promoted {"name":"Hello","command":"hello"}'),
    )

    services.tags.promote.mockResolvedValueOnce({ kind: 'requested', tag })
    services.tagReconciler.reconcileGuild.mockResolvedValueOnce({
      failures: [{ intentId: 7, error: new Error('Missing Access') }],
    })
    const failed = interaction({ strings: { name: 'Hello' }, manage: true })
    await command.chatInputPromote(failed as never)
    expect(failed.reply).toHaveBeenCalledWith(
      ephemeral(
        'commands/tag:promoteFailed {"name":"hello","error":"Missing Access"}',
      ),
    )

    services.tags.promote.mockResolvedValueOnce({ kind: 'limit', limit: 2 })
    const limit = interaction({ strings: { name: 'Hello' }, manage: true })
    await command.chatInputPromote(limit as never)
    expect(limit.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'commands/tag:promoteLimitReached {"limit":2}',
        components: expect.arrayContaining([expect.anything()]),
      }),
    )
  })

  it('demotes through the service and reports repair failures with demote copy', async () => {
    services.tags.demote.mockResolvedValueOnce({ kind: 'notPromoted', tag })
    const plain = interaction({ strings: { name: 'Hello' }, manage: true })
    await command.chatInputDemote(plain as never)
    expect(plain.reply).toHaveBeenCalledWith(
      ephemeral('commands/tag:notPromoted {"name":"Hello"}'),
    )
    services.tags.demote.mockResolvedValueOnce({ kind: 'requested', tag })
    services.tagReconciler.reconcileGuild.mockResolvedValueOnce({
      failures: [{ intentId: 7, error: new Error('Down') }],
    })
    const failed = interaction({ strings: { name: 'Hello' }, manage: true })
    await command.chatInputDemote(failed as never)
    expect(failed.reply).toHaveBeenCalledWith(
      ephemeral('commands/tag:demoteFailed {"name":"hello","error":"Down"}'),
    )
  })

  it('lists promoted tags as their slash command', async () => {
    const list = interaction({})
    await command.chatInputList(list as never)
    expect(list.reply).toHaveBeenCalledWith(
      ephemeral('commands/tag:list {"count":2,"names":"`Hello`, `/promo`"}'),
    )
  })

  it('routes autocomplete through the shared gate and the guild-scoped search', async () => {
    const auto = interaction({ subcommand: 'demote' })
    await command.autocompleteRun(auto as never)
    expect(services.tags.search).toHaveBeenCalledWith(90001n, 'hel', true)
    expect(auto.respond).toHaveBeenCalledWith([
      { name: 'Hello', value: 'Hello' },
    ])

    vi.spyOn(services.flags, 'enabled').mockResolvedValueOnce(false)
    const gated = interaction({})
    await command.autocompleteRun(gated as never)
    expect(gated.respond).toHaveBeenCalledWith([])
    expect(services.tags.search).toHaveBeenCalledTimes(1)
  })

  it('answers instead of timing out while the runtime is draining', async () => {
    services.work.close()
    const stopping = interaction({
      strings: { name: 'Hello' },
      subcommand: 'show',
    })
    await command.chatInputRun(stopping as never, {} as never)
    expect(stopping.reply).toHaveBeenCalledWith({
      content: 'system/errors:feature_unavailable',
      flags: MessageFlags.Ephemeral,
    })
    expect(services.tags.find).not.toHaveBeenCalled()
    const auto = interaction({})
    await command.autocompleteRun(auto as never)
    expect(auto.respond).toHaveBeenCalledWith([])
  })
})
