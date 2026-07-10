import { snapshotEnv } from '@thesharks/test-utils'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import {
  guildTierForInteraction,
  limitFor,
  tierForInteraction,
  userTierForInteraction,
} from '../src/premium/entitlements.mjs'
import { getLimit, limitKeys } from '../src/premium/limits.mjs'
import {
  parsePremiumSkus,
  premiumSkuMap,
  skuIdForTier,
} from '../src/premium/skus.mjs'
import { entitlementRow } from '../src/premium/sync.mjs'
import {
  FREE_TIER,
  highestTier,
  isPremiumTier,
  PREMIUM_TIERS,
  tierAtLeast,
} from '../src/premium/tiers.mjs'

const restoreEnv = snapshotEnv(['WILDBEAST_PREMIUM_SKUS'])
afterEach(() => {
  delete process.env.WILDBEAST_PREMIUM_SKUS
})
afterAll(restoreEnv)

interface FakeEntitlement {
  skuId: string
  active?: boolean
  /** Set for guild-subscription entitlements, like the real payloads. */
  guildId?: string
}

/** Minimal stand-in for an interaction carrying entitlements. */
function fakeInteraction(
  entitlements: FakeEntitlement[],
  guildId: string | null = '500',
) {
  return {
    guildId,
    entitlements: new Map(
      entitlements.map((entitlement, index) => [
        String(index),
        {
          skuId: entitlement.skuId,
          guildId: entitlement.guildId ?? null,
          isActive: () => entitlement.active ?? true,
        },
      ]),
    ),
  } as never
}

describe('tiers', () => {
  it('orders tiers by privilege', () => {
    expect(tierAtLeast('premium', 'free')).toBe(true)
    expect(tierAtLeast('free', 'premium')).toBe(false)
    expect(tierAtLeast('premium', 'premium')).toBe(true)
  })

  it('picks the highest tier, defaulting to free', () => {
    expect(highestTier([])).toBe(FREE_TIER)
    expect(highestTier(['free', 'premium', 'free'])).toBe('premium')
  })

  it('recognizes known tiers only', () => {
    for (const tier of PREMIUM_TIERS) {
      expect(isPremiumTier(tier)).toBe(true)
    }
    expect(isPremiumTier('gold')).toBe(false)
  })
})

describe('parsePremiumSkus', () => {
  it('returns an empty map when unset', () => {
    expect(parsePremiumSkus(undefined).size).toBe(0)
    expect(parsePremiumSkus('').size).toBe(0)
  })

  it('parses skuId:tier pairs, defaulting scope to any', () => {
    const map = parsePremiumSkus('123:premium, 456:free')
    expect(map.get('123')).toEqual({ tier: 'premium', scope: 'any' })
    expect(map.get('456')).toEqual({ tier: 'free', scope: 'any' })
  })

  it('parses explicit user/guild scopes', () => {
    const map = parsePremiumSkus('123:premium:user,456:premium:guild')
    expect(map.get('123')).toEqual({ tier: 'premium', scope: 'user' })
    expect(map.get('456')).toEqual({ tier: 'premium', scope: 'guild' })
  })

  it('rejects malformed entries with a readable message', () => {
    expect(() => parsePremiumSkus('123')).toThrow(/expected "skuId:tier"/)
    expect(() => parsePremiumSkus('123:premium:user:x')).toThrow(
      /expected "skuId:tier"/,
    )
    expect(() => parsePremiumSkus('abc:premium')).toThrow(/not a snowflake/)
    expect(() => parsePremiumSkus('123:gold')).toThrow(/Unknown premium tier/)
    expect(() => parsePremiumSkus('123:premium:everyone')).toThrow(
      /Unknown premium scope/,
    )
    expect(() => parsePremiumSkus('123:premium,123:free')).toThrow(
      /listed more than once/,
    )
  })

  it('reads WILDBEAST_PREMIUM_SKUS via premiumSkuMap', () => {
    expect(premiumSkuMap({}).size).toBe(0)
    expect(
      premiumSkuMap({ WILDBEAST_PREMIUM_SKUS: '123:premium' }).get('123')?.tier,
    ).toBe('premium')
  })
})

describe('skuIdForTier', () => {
  it('returns undefined when nothing grants the tier', () => {
    expect(skuIdForTier('premium', 'any', {})).toBeUndefined()
    expect(
      skuIdForTier('premium', 'any', { WILDBEAST_PREMIUM_SKUS: '123:free' }),
    ).toBeUndefined()
  })

  it('prefers the lowest tier that still suffices', () => {
    const env = { WILDBEAST_PREMIUM_SKUS: '111:premium,222:free' }
    expect(skuIdForTier('free', 'any', env)).toBe('222')
    expect(skuIdForTier('premium', 'any', env)).toBe('111')
  })

  it('respects the requested scope', () => {
    const env = {
      WILDBEAST_PREMIUM_SKUS: '111:premium:user,222:premium:guild',
    }
    expect(skuIdForTier('premium', 'user', env)).toBe('111')
    expect(skuIdForTier('premium', 'guild', env)).toBe('222')
  })

  it('falls back to any-scoped SKUs but prefers an exact match', () => {
    expect(
      skuIdForTier('premium', 'guild', {
        WILDBEAST_PREMIUM_SKUS: '111:premium',
      }),
    ).toBe('111')
    expect(
      skuIdForTier('premium', 'guild', {
        WILDBEAST_PREMIUM_SKUS: '111:premium,222:premium:guild',
      }),
    ).toBe('222')
  })
})

describe('limit registry', () => {
  it('defines a positive cap for every tier of every limit', () => {
    for (const key of limitKeys) {
      for (const tier of PREMIUM_TIERS) {
        expect(getLimit(key, tier)).toBeGreaterThan(0)
      }
    }
  })

  it('never lowers a cap for a higher tier', () => {
    for (const key of limitKeys) {
      for (let i = 1; i < PREMIUM_TIERS.length; i++) {
        expect(getLimit(key, PREMIUM_TIERS[i])).toBeGreaterThanOrEqual(
          getLimit(key, PREMIUM_TIERS[i - 1]),
        )
      }
    }
  })
})

describe('tier resolution from interactions', () => {
  it('is free when no SKUs are configured', () => {
    expect(tierForInteraction(fakeInteraction([{ skuId: '123' }]))).toBe(
      FREE_TIER,
    )
  })

  it('scopes user subscriptions to the user', () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium'
    const interaction = fakeInteraction([{ skuId: '123' }])
    expect(userTierForInteraction(interaction)).toBe('premium')
    expect(guildTierForInteraction(interaction)).toBe(FREE_TIER)
    expect(tierForInteraction(interaction)).toBe('premium')
  })

  it('scopes guild subscriptions to the current guild', () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium'
    const interaction = fakeInteraction([{ skuId: '123', guildId: '500' }])
    expect(userTierForInteraction(interaction)).toBe(FREE_TIER)
    expect(guildTierForInteraction(interaction)).toBe('premium')
    expect(tierForInteraction(interaction)).toBe('premium')
  })

  it('ignores guild entitlements from other guilds and everything in DMs', () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium'
    expect(
      guildTierForInteraction(
        fakeInteraction([{ skuId: '123', guildId: '999' }]),
      ),
    ).toBe(FREE_TIER)
    expect(
      guildTierForInteraction(
        fakeInteraction([{ skuId: '123', guildId: '500' }], null),
      ),
    ).toBe(FREE_TIER)
  })

  it('ignores inactive and unknown entitlements', () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium'
    expect(
      tierForInteraction(
        fakeInteraction([{ skuId: '123', active: false }, { skuId: '999' }]),
      ),
    ).toBe(FREE_TIER)
  })

  it('resolves guild-scoped limits by the guild subscription only', async () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium'
    const free = await limitFor(fakeInteraction([]), 'tags.maxPerGuild')
    const viaUserSub = await limitFor(
      fakeInteraction([{ skuId: '123' }]),
      'tags.maxPerGuild',
    )
    const viaGuildSub = await limitFor(
      fakeInteraction([{ skuId: '123', guildId: '500' }]),
      'tags.maxPerGuild',
    )
    expect(viaUserSub).toBe(free)
    expect(viaGuildSub).toBeGreaterThan(free)
  })
})

describe('entitlementRow', () => {
  it('maps a gateway entitlement to its mirror row', () => {
    const startsAt = new Date('2026-01-01T00:00:00Z')
    const row = entitlementRow({
      id: '900',
      skuId: '123',
      userId: '456',
      guildId: null,
      type: 8,
      deleted: false,
      startsAt,
      endsAt: null,
    } as never)
    expect(row).toEqual({
      id: 900n,
      skuId: 123n,
      userId: 456n,
      guildId: null,
      type: 8,
      deleted: false,
      startsAt,
      endsAt: null,
    })
  })
})
