import { InMemoryProvider } from '@openfeature/server-sdk'
import { silentLogger } from '@thesharks/test-utils'
import { describe, expect, it } from 'vitest'
import { FeatureFlags } from '../src/features/flags.mjs'
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

const context = { targetingKey: '500', environment: 'test' }
const offline = new FeatureFlags()

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

describe('flag inspection', () => {
  it('covers every registered flag plus every limit flag', () => {
    const keys = inspectableKeys()
    for (const key of flagKeys) expect(keys).toContain(key)
    for (const key of limitKeys) expect(keys).toContain(`limits.${key}`)
  })

  it('returns undefined for unknown keys', async () => {
    expect(
      await inspectFlag(offline, 'limits.not.a.flag', context),
    ).toBeUndefined()
    expect(
      await inspectFlag(offline, 'features.commands.nope', context),
    ).toBeUndefined()
  })

  it('evaluates gates and limits from in-code defaults when no provider is active', async () => {
    expect(
      await inspectFlag(offline, 'features.commands.tag', context),
    ).toMatchObject({
      kind: 'gate',
      value: 'enabled',
      source: 'default',
      defaultValue: 'enabled',
    })
    expect(
      await inspectFlag(offline, 'limits.tags.maxPerGuild', context),
    ).toMatchObject({
      kind: 'limit',
      value: String(getLimit('tags.maxPerGuild', 'free')),
    })
    const premium = await inspectFlag(offline, 'limits.tags.maxPerGuild', {
      ...context,
      tier: 'premium',
    })
    expect(premium?.value).toBe(String(getLimit('tags.maxPerGuild', 'premium')))
    const enforced = await inspectFlag(offline, 'limits.tags.maxPerGuild', {
      ...context,
      tier: 'premium',
      tierEnforced: 'free',
    })
    expect(enforced?.value).toBe(String(getLimit('tags.maxPerGuild', 'free')))
    expect(enforced?.description).toContain('free')
  })

  it('reflects provider overrides with their source', async () => {
    const flags = new FeatureFlags({
      logger: silentLogger,
      provider: new InMemoryProvider({
        'features.commands.tag': {
          disabled: false,
          defaultVariant: 'off',
          variants: { off: false },
        },
      }),
    })
    await flags.open()
    expect(
      await inspectFlag(flags, 'features.commands.tag', context),
    ).toMatchObject({
      value: 'disabled',
      source: 'provider',
    })
    await flags.close()
  })

  it('inspects every inspectable key in one sweep', async () => {
    const results = await inspectAllFlags(offline, context)
    expect(results.map((result) => result.key).sort()).toEqual(
      inspectableKeys().sort(),
    )
  })
})

describe('flag formatting', () => {
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

  it('splits long lists into Discord-sized chunks and carries error messages', () => {
    const many = Array.from({ length: 200 }, (_, index) =>
      inspection({ key: `features.commands.fixture${index}` }),
    )
    const chunks = formatFlagList(many)
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(1_900)
    const [chunk] = formatFlagList([
      inspection({ source: 'error', errorMessage: 'provider unreachable' }),
    ])
    expect(chunk).toContain('provider unreachable')
  })

  it('shows the full definition, expiry and errors in the detail view', () => {
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
    expect(detail).toContain('variants: plain, suggestion')
    expect(detail).toContain('expires: 2027-01-31')
    expect(detail).not.toContain('expired')
    const expired = formatFlagDetail(
      inspection({
        expired: true,
        expiresAt: '2020-01-01',
        errorMessage: 'boom',
      }),
    )
    expect(expired).toContain('expired: 2020-01-01')
    expect(expired).toContain('error: boom')
  })
})
