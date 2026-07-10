import { InMemoryProvider } from '@openfeature/server-sdk'
import { silentLogger, snapshotEnv } from '@thesharks/test-utils'
import { afterAll, describe, expect, it } from 'vitest'
import { limitFor } from '../src/premium/entitlements.mjs'
import {
  closeFeatureFlags,
  featureFlagsActive,
  initFeatureFlags,
  providerFromEnv,
} from '../src/premium/features.mjs'
import { getLimit } from '../src/premium/limits.mjs'

const restoreEnv = snapshotEnv(['WILDBEAST_OFREP', 'WILDBEAST_PREMIUM'])
afterAll(async () => {
  await closeFeatureFlags()
  restoreEnv()
})

const FREE_TAG_LIMIT = getLimit('tags.maxPerGuild', 'free')

/** No premium SKUs configured in these tests, so tiers are always free;
 * only the flag evaluation path varies. */
function fakeInteraction(guildId: string | null = '500') {
  return {
    guildId,
    user: { id: '900' },
    entitlements: new Map(),
  } as never
}

describe('providerFromEnv', () => {
  it('is undefined without WILDBEAST_OFREP_URL', () => {
    expect(providerFromEnv({})).toBeUndefined()
  })

  it('builds an OFREP provider from the environment', () => {
    const provider = providerFromEnv({
      WILDBEAST_OFREP_URL: 'http://localhost:8016',
      WILDBEAST_OFREP_TOKEN: 'secret',
    })
    expect(provider?.metadata.name).toBeTruthy()
  })
})

describe('feature flag lifecycle', () => {
  // Ordered: the OpenFeature singleton is process-global, so these tests
  // walk one lifecycle — off, on with overrides, closed again.
  it('stays inactive when nothing is configured', async () => {
    expect(await initFeatureFlags({ logger: silentLogger })).toBe(false)
    expect(featureFlagsActive()).toBe(false)
    expect(await limitFor(fakeInteraction(), 'tags.maxPerGuild')).toBe(
      FREE_TAG_LIMIT,
    )
  })

  it('falls back to the registry value when no flag rule exists', async () => {
    const provider = new InMemoryProvider({})
    expect(await initFeatureFlags({ logger: silentLogger, provider })).toBe(
      true,
    )
    expect(featureFlagsActive()).toBe(true)
    expect(await limitFor(fakeInteraction(), 'tags.maxPerGuild')).toBe(
      FREE_TAG_LIMIT,
    )
  })

  it('lets the flag service override limits per guild', async () => {
    const provider = new InMemoryProvider({
      'limits.tags.maxPerGuild': {
        disabled: false,
        variants: { standard: FREE_TAG_LIMIT, boosted: 9_000 },
        defaultVariant: 'standard',
        contextEvaluator: (context) =>
          context.guildId === '42' ? 'boosted' : 'standard',
      },
    })
    await initFeatureFlags({ logger: silentLogger, provider })

    expect(await limitFor(fakeInteraction('42'), 'tags.maxPerGuild')).toBe(
      9_000,
    )
    expect(await limitFor(fakeInteraction('7'), 'tags.maxPerGuild')).toBe(
      FREE_TAG_LIMIT,
    )
  })

  it('returns to in-code defaults after close', async () => {
    await closeFeatureFlags()
    expect(featureFlagsActive()).toBe(false)
    expect(await limitFor(fakeInteraction('42'), 'tags.maxPerGuild')).toBe(
      FREE_TAG_LIMIT,
    )
  })
})
