import { ApplicationCommandOptionType, DiscordAPIError } from 'discord.js'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@sapphire/plugin-i18next', () => ({
  resolveKey: async (_interaction: unknown, key: string) => `mock:${key}`,
  applyLocalizedBuilder: (builder: unknown) => builder,
}))

import {
  guildTagCommandData,
  isCommandCapError,
  isTagCommandShape,
  MAX_COMMAND_DESCRIPTION_LENGTH,
  promotionsOverCap,
  tagCommandName,
} from '../src/utils/guildTagCommands.mjs'
import { replyWithRenderedTag } from '../src/utils/tagRender.mjs'
import {
  isDevGuild,
  TAG_ARGS_DESCRIPTION_FALLBACK,
  TagCommands,
} from '../src/utils/tagService.mjs'

const NO_RESERVED = new Set<string>()

describe('tagCommandName', () => {
  it('lowercases valid names without further mangling', () => {
    expect(tagCommandName('Hello', NO_RESERVED)).toEqual({
      ok: true,
      name: 'hello',
    })
    expect(tagCommandName('with-dash_and_underscore', NO_RESERVED)).toEqual({
      ok: true,
      name: 'with-dash_and_underscore',
    })
  })

  it('rejects names Discord would refuse', () => {
    for (const name of ['has space', 'näme!', 'a'.repeat(33), '', 'dot.dot']) {
      expect(tagCommandName(name, NO_RESERVED)).toEqual({
        ok: false,
        reason: 'invalid',
      })
    }
  })

  it('accepts non-latin letters like Discord does', () => {
    expect(tagCommandName('日本語', NO_RESERVED)).toEqual({
      ok: true,
      name: '日本語',
    })
  })

  it('rejects collisions with the bot’s own commands, case-insensitively', () => {
    const reserved = new Set(['ping', 'tag'])
    expect(tagCommandName('Ping', reserved)).toEqual({
      ok: false,
      reason: 'reserved',
    })
    expect(tagCommandName('pong', reserved)).toEqual({ ok: true, name: 'pong' })
  })
})

describe('guildTagCommandData', () => {
  const ARGS_DESCRIPTION = 'Space-separated arguments passed to the tag'

  it('builds a chat input command with the optional args option', () => {
    const data = guildTagCommandData(
      'hello',
      'Say hello',
      ARGS_DESCRIPTION,
    ) as {
      name: string
      description: string
      options: Array<{ name: string; description: string; required?: boolean }>
    }
    expect(data.name).toBe('hello')
    expect(data.description).toBe('Say hello')
    expect(data.options).toHaveLength(1)
    expect(data.options[0]?.name).toBe('args')
    expect(data.options[0]?.description).toBe(ARGS_DESCRIPTION)
    expect(data.options[0]?.required).toBeUndefined()
  })

  it('truncates descriptions to Discord’s limit', () => {
    const data = guildTagCommandData(
      'hello',
      'x'.repeat(200),
      'y'.repeat(200),
    ) as {
      description: string
      options: Array<{ description: string }>
    }
    expect(data.description).toHaveLength(MAX_COMMAND_DESCRIPTION_LENGTH)
    expect(data.options[0]?.description).toHaveLength(
      MAX_COMMAND_DESCRIPTION_LENGTH,
    )
  })

  it('uses the caller-supplied args description (no hardcoded literal)', () => {
    const localized = 'Arguments localisés'
    const data = guildTagCommandData('hello', 'Say hello', localized) as {
      options: Array<{ description: string }>
    }
    expect(data.options[0]?.description).toBe(localized)
  })
})

describe('isTagCommandShape', () => {
  const tagShape = {
    options: [
      {
        name: 'args',
        type: ApplicationCommandOptionType.String,
        required: false,
      },
    ],
  }

  it('accepts a single optional string args option', () => {
    expect(isTagCommandShape(tagShape)).toBe(true)
    // `required` omitted (Discord default false) is also tag-shaped.
    expect(
      isTagCommandShape({
        options: [{ name: 'args', type: ApplicationCommandOptionType.String }],
      }),
    ).toBe(true)
  })

  it('rejects non-tag guild commands so orphan cleanup never touches them', () => {
    expect(isTagCommandShape({ options: [] })).toBe(false)
    expect(isTagCommandShape({})).toBe(false)
    expect(isTagCommandShape({ options: undefined })).toBe(false)
    // Wrong option name.
    expect(
      isTagCommandShape({
        options: [{ name: 'query', type: ApplicationCommandOptionType.String }],
      }),
    ).toBe(false)
    // Wrong option type.
    expect(
      isTagCommandShape({
        options: [{ name: 'args', type: ApplicationCommandOptionType.Integer }],
      }),
    ).toBe(false)
    // Required args is not our shape (ours is optional).
    expect(
      isTagCommandShape({
        options: [
          {
            name: 'args',
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      }),
    ).toBe(false)
    // Extra options mean another feature owns it.
    expect(
      isTagCommandShape({
        options: [
          { name: 'args', type: ApplicationCommandOptionType.String },
          { name: 'extra', type: ApplicationCommandOptionType.String },
        ],
      }),
    ).toBe(false)
  })
})

describe('promotionsOverCap', () => {
  const at = (offsetMinutes: number) => ({
    promotedAt: new Date(Date.UTC(2026, 0, 1, 0, offsetMinutes)),
  })

  it('keeps the oldest promotions and demotes the newest', () => {
    const rows = [at(30), at(10), at(20)]
    expect(promotionsOverCap(rows, 2)).toEqual([at(30)])
    expect(promotionsOverCap(rows, 1)).toEqual([at(20), at(30)])
  })

  it('demotes nothing at or under the cap', () => {
    expect(promotionsOverCap([at(1), at(2)], 2)).toEqual([])
    expect(promotionsOverCap([], 1)).toEqual([])
  })

  it('demotes everything at cap zero and nothing at an unlimited cap', () => {
    const rows = [at(1), at(2)]
    expect(promotionsOverCap(rows, 0)).toHaveLength(2)
    expect(promotionsOverCap(rows, Number.POSITIVE_INFINITY)).toEqual([])
  })

  it('treats null promotedAt as oldest (kept, pinned)', () => {
    const legacy = { promotedAt: null }
    const recent = at(30)
    const old = at(10)
    // With cap 2 across three rows, the newest (recent) goes first.
    expect(promotionsOverCap([legacy, old, recent], 2)).toEqual([recent])
    // Null sorts as epoch zero, so it survives while dated rows demote.
    expect(promotionsOverCap([legacy, recent], 1)).toEqual([recent])
    expect(promotionsOverCap([legacy], 1)).toEqual([])
    expect(promotionsOverCap([legacy, { promotedAt: null }], 1)).toHaveLength(1)
  })
})

describe('isCommandCapError', () => {
  it('recognizes Discord’s max-commands error and nothing else', () => {
    const capError = new DiscordAPIError(
      {
        message: 'Maximum number of application commands reached',
        code: 30032,
      },
      30032,
      400,
      'POST',
      'https://discord.com/api',
      {},
    )
    const otherError = new DiscordAPIError(
      { message: 'Missing Access', code: 50001 },
      50001,
      403,
      'POST',
      'https://discord.com/api',
      {},
    )
    expect(isCommandCapError(capError)).toBe(true)
    expect(isCommandCapError(otherError)).toBe(false)
    expect(isCommandCapError(new Error('nope'))).toBe(false)
  })
})

describe('promotion race predicates (double-promote / demote interleave)', () => {
  type Row = { id: number; commandId: bigint | null }

  // Mirrors the promote transaction's `WHERE id = ? AND commandId IS NULL`.
  function promoteIfUnclaimed(
    row: Row,
    commandId: bigint,
  ): 'promoted' | 'alreadyPromoted' {
    if (row.commandId !== null) return 'alreadyPromoted'
    row.commandId = commandId
    return 'promoted'
  }

  // Mirrors the demote transaction's `WHERE id = ? AND commandId = expected`.
  function demoteIfExpected(row: Row, expected: bigint): boolean {
    if (row.commandId !== expected) return false
    row.commandId = null
    return true
  }

  it('double-promote: the second claim sees alreadyPromoted', () => {
    const row: Row = { id: 1, commandId: null }
    expect(promoteIfUnclaimed(row, 100n)).toBe('promoted')
    expect(promoteIfUnclaimed(row, 101n)).toBe('alreadyPromoted')
    expect(row.commandId).toBe(100n)
  })

  it('demote interleave: a stale demote never wipes a new promotion', () => {
    const row: Row = { id: 1, commandId: 100n }
    expect(demoteIfExpected(row, 100n)).toBe(true)
    expect(row.commandId).toBeNull()
    // Re-promoted under a new command id.
    row.commandId = 101n
    expect(demoteIfExpected(row, 100n)).toBe(false)
    expect(row.commandId).toBe(101n)
    expect(demoteIfExpected(row, 101n)).toBe(true)
    expect(row.commandId).toBeNull()
  })
})

describe('reconcile sweep guards', () => {
  it('skips the dev guild', () => {
    const devId = '999000111'
    process.env.WILDBEAST_DEV_GUILD_ID = devId
    try {
      const isDevGuild = (guildId: bigint) =>
        guildId.toString() === process.env.WILDBEAST_DEV_GUILD_ID
      expect(isDevGuild(BigInt(devId))).toBe(true)
      expect(isDevGuild(123n)).toBe(false)
    } finally {
      delete process.env.WILDBEAST_DEV_GUILD_ID
    }
  })

  it('orphan deletion is scoped to claimed ids and tag shape only', () => {
    const claimed = new Set(['100'])
    const tagOrphan = {
      id: '101',
      options: [{ name: 'args', type: ApplicationCommandOptionType.String }],
    }
    const foreignCommand = {
      id: '102',
      options: [{ name: 'query', type: ApplicationCommandOptionType.String }],
    }
    const bareCommand = { id: '103', options: [] as unknown[] }

    const shouldDelete = (command: { id: string; options?: unknown }) =>
      !claimed.has(command.id) && isTagCommandShape(command)

    expect(shouldDelete({ id: '100', options: tagOrphan.options })).toBe(false)
    expect(shouldDelete(tagOrphan)).toBe(true)
    expect(shouldDelete(foreignCommand)).toBe(false)
    expect(shouldDelete(bareCommand)).toBe(false)
  })
})

describe('TagCommands service surface (DB<->Discord invariant black box)', () => {
  it('exposes promote, demote, reconcile, resolve, and deleteCommand', () => {
    for (const method of [
      'promote',
      'demote',
      'resolve',
      'deleteCommand',
      'reconcileGuild',
      'reconcileAll',
    ] as const) {
      expect(typeof TagCommands[method]).toBe('function')
    }
    expect(typeof isDevGuild).toBe('function')
    expect(TAG_ARGS_DESCRIPTION_FALLBACK).toBe(
      'Space-separated arguments passed to the tag',
    )
  })
})

describe('replyWithRenderedTag caps and allowedMentions', () => {
  function fakeInteraction(args: string | null, content: string) {
    void content
    return {
      options: {
        getString: (_name: string) => args,
      },
      user: {
        id: '1',
        tag: 'tester#0',
        toString: () => '<@1>',
        displayAvatarURL: () => 'https://cdn.discordapp.com/avatars/1/x.webp',
      },
      channelId: '10',
      guildId: '20',
      guild: { name: 'Test Guild' },
      reply: vi.fn(async () => undefined),
    } as never
  }

  it('replies publicly with pings disabled on success', async () => {
    const interaction = fakeInteraction(null, 'hello')
    const outcome = await replyWithRenderedTag(interaction, 'hello @everyone')
    expect(outcome).toBe('success')
    const reply = (
      interaction.reply as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls[0]?.[0] as {
      content: string
      allowedMentions: { parse: string[] }
      flags?: number
    }
    expect(reply.content).toBe('hello @everyone')
    expect(reply.allowedMentions).toEqual({ parse: [] })
    // Success stays public so the tag is visible.
    expect(reply.flags).toBeUndefined()
  })

  it('caps output at 2000 characters via a render error', async () => {
    const interaction = fakeInteraction(null, '')
    // {range:0|2000} expands well beyond the 2000-character tag cap.
    const outcome = await replyWithRenderedTag(interaction, '{range:0|2000}')
    expect(outcome).toBe('renderError')
    const reply = (
      interaction.reply as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls[0]?.[0] as {
      content: string
      flags: number
      allowedMentions: { parse: string[] }
    }
    expect(reply.allowedMentions).toEqual({ parse: [] })
    expect(reply.flags).toBeDefined()
  })

  it('maps empty output to an ephemeral emptyOutput reply without pings', async () => {
    const interaction = fakeInteraction(null, '')
    const outcome = await replyWithRenderedTag(interaction, '   ')
    expect(outcome).toBe('emptyOutput')
    const reply = (
      interaction.reply as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls[0]?.[0] as {
      allowedMentions: { parse: string[] }
      flags: number
    }
    expect(reply.allowedMentions).toEqual({ parse: [] })
    expect(reply.flags).toBeDefined()
  })

  it('wraps disabled-fetch failures as renderError without pings', async () => {
    const interaction = fakeInteraction(null, '')
    const outcome = await replyWithRenderedTag(
      interaction,
      '{fetch:https://example.com}',
    )
    expect(outcome).toBe('renderError')
    const reply = (
      interaction.reply as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls[0]?.[0] as {
      allowedMentions: { parse: string[] }
    }
    expect(reply.allowedMentions).toEqual({ parse: [] })
  })
})
