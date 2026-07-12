import { DiscordAPIError } from 'discord.js'
import { describe, expect, it } from 'vitest'
import {
  guildTagCommandData,
  isCommandCapError,
  MAX_COMMAND_DESCRIPTION_LENGTH,
  promotionsOverCap,
  tagCommandName,
} from '../src/utils/guildTagCommands.mjs'

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
  it('builds a chat input command with the optional args option', () => {
    const data = guildTagCommandData('hello', 'Say hello') as {
      name: string
      description: string
      options: Array<{ name: string; required?: boolean }>
    }
    expect(data.name).toBe('hello')
    expect(data.description).toBe('Say hello')
    expect(data.options).toHaveLength(1)
    expect(data.options[0]?.name).toBe('args')
    expect(data.options[0]?.required).toBeUndefined()
  })

  it('truncates descriptions to Discord’s limit', () => {
    const data = guildTagCommandData('hello', 'x'.repeat(200)) as {
      description: string
    }
    expect(data.description).toHaveLength(MAX_COMMAND_DESCRIPTION_LENGTH)
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
