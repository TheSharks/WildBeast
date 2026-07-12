import { InMemoryProvider } from '@openfeature/server-sdk'
import { container } from '@sapphire/framework'
import { silentLogger } from '@thesharks/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { closeFeatureFlags, initFeatureFlags } from '../src/features/client.mjs'
import {
  type FlagInspection,
  formatFlagDetail,
  formatFlagList,
  inspectAllFlags,
  inspectableKeys,
  inspectFlag,
} from '../src/features/inspect.mjs'
import { flagKeys } from '../src/features/registry.mjs'
import { getLimit, limitKeys } from '../src/premium/limits.mjs'

container.logger = silentLogger

afterEach(async () => {
  await closeFeatureFlags()
})

const context = { targetingKey: '500', environment: 'test' }

function inspection(overrides: Partial<FlagInspection> = {}): FlagInspection {
  return {
    key: 'features.commands.tag',
    kind: 'gate',
    owner: 'discord',
    description: 'Whether /tag may run',
    value: 'enabled',
    source: 'default',
    expired: false,
    defaultValue: 'enabled',
    ...overrides,
  }
}

describe('inspectableKeys', () => {
  it('covers every registered flag plus every limit flag', () => {
    const keys = inspectableKeys()
    for (const key of flagKeys) {
      expect(keys).toContain(key)
    }
    for (const key of limitKeys) {
      expect(keys).toContain(`limits.${key}`)
    }
  })
})

describe('inspectFlag / inspectAllFlags', () => {
  it('returns undefined for unknown keys', async () => {
    expect(await inspectFlag('limits.not.a.flag', context)).toBeUndefined()
    expect(await inspectFlag('features.commands.nope', context)).toBeUndefined()
  })

  it('evaluates gates from in-code defaults when no provider is active', async () => {
    const result = await inspectFlag('features.commands.tag', context)
    expect(result).toMatchObject({
      kind: 'gate',
      value: 'enabled',
      source: 'default',
      defaultValue: 'enabled',
    })
  })

  it('evaluates limits at the context tier’s registry value', async () => {
    const free = await inspectFlag('limits.tags.maxPerGuild', context)
    expect(free).toMatchObject({
      kind: 'limit',
      value: String(getLimit('tags.maxPerGuild', 'free')),
    })

    const premium = await inspectFlag('limits.tags.maxPerGuild', {
      ...context,
      tier: 'premium',
    })
    expect(premium?.value).toBe(String(getLimit('tags.maxPerGuild', 'premium')))
  })

  it('reflects provider overrides with their source', async () => {
    await initFeatureFlags({
      logger: silentLogger,
      provider: new InMemoryProvider({
        'features.commands.tag': {
          disabled: false,
          defaultVariant: 'off',
          variants: { off: false },
        },
      }),
    })

    const result = await inspectFlag('features.commands.tag', context)
    expect(result).toMatchObject({ value: 'disabled', source: 'provider' })
  })

  it('inspects every inspectable key in one sweep', async () => {
    const results = await inspectAllFlags(context)
    expect(results.map((result) => result.key).sort()).toEqual(
      inspectableKeys().sort(),
    )
  })
})

describe('formatFlagList', () => {
  it('pins expired flags to a warning section on top', () => {
    const chunks = formatFlagList([
      inspection(),
      inspection({
        key: 'experiments.old',
        kind: 'experiment',
        expired: true,
        expiresAt: '2020-01-01',
      }),
    ])
    expect(chunks).toHaveLength(1)
    const [first, second] = chunks[0]!.split('\n')
    expect(first).toContain('1 flag(s) past expiry')
    expect(second).toContain('experiments.old')
  })

  it('splits long lists into Discord-sized chunks', () => {
    const many = Array.from({ length: 200 }, (_, index) =>
      inspection({ key: `features.commands.fixture${index}` }),
    )
    const chunks = formatFlagList(many)
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1_900)
    }
  })

  it('carries error messages into the line', () => {
    const [chunk] = formatFlagList([
      inspection({ source: 'error', errorMessage: 'provider unreachable' }),
    ])
    expect(chunk).toContain('provider unreachable')
  })
})

describe('formatFlagDetail', () => {
  it('shows the full definition for experiments', () => {
    const detail = formatFlagDetail(
      inspection({
        key: 'experiments.tags.notFoundReply',
        kind: 'experiment',
        value: 'suggestion',
        defaultValue: 'suggestion',
        variants: ['plain', 'suggestion'],
        expiresAt: '2027-01-31',
      }),
    )
    expect(detail).toContain('experiments.tags.notFoundReply')
    expect(detail).toContain('variants: plain, suggestion')
    expect(detail).toContain('expires: 2027-01-31')
    expect(detail).not.toContain('expired')
  })

  it('flags expiry and errors prominently', () => {
    const detail = formatFlagDetail(
      inspection({
        expired: true,
        expiresAt: '2020-01-01',
        errorMessage: 'boom',
      }),
    )
    expect(detail).toContain('expired: 2020-01-01')
    expect(detail).toContain('error: boom')
  })
})
