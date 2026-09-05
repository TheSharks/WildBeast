import { snapshotEnv } from '@thesharks/test-utils'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import {
  capForGuild,
  guildTierForInteraction,
  limitFor,
  tierForInteraction,
  userTierForInteraction,
} from '../src/premium/entitlements.mjs'
import {
  clampLimitOverride,
  getLimit,
  limitKeys,
  MAX_LIMIT_OVERRIDE,
} from '../src/premium/limits.mjs'
import {
  parsePremiumSkus,
  premiumSkuMap,
  skuIdForTier,
} from '../src/premium/skus.mjs'
import {
  entitlementRow,
  fetchAllEntitlementRows,
  toMirrorRow,
} from '../src/premium/sync.mjs'
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
    guild: null,
    user: { id: '900' },
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
    expect(() => parsePremiumSkus('123:premium:everyone')).toThrow(/any/)
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

  it('stores guild subscriptions as guild-only rows when both ids are set', () => {
    const row = entitlementRow({
      id: '901',
      skuId: '123',
      userId: '456',
      guildId: '789',
      type: 8,
      deleted: false,
      startsAt: null,
      endsAt: null,
    } as never)
    expect(row).toMatchObject({ userId: null, guildId: 789n })
  })

  it('keeps user-only and guild-only rows as-is', () => {
    const base = {
      id: 902n,
      skuId: 123n,
      type: 8,
      deleted: false,
      startsAt: null,
      endsAt: null,
    } as const
    expect(toMirrorRow({ ...base, userId: 456n, guildId: null })).toMatchObject(
      { userId: 456n, guildId: null },
    )
    expect(toMirrorRow({ ...base, userId: null, guildId: 789n })).toMatchObject(
      { userId: null, guildId: 789n },
    )
  })

  it('normalizes both-set payloads seen during paginated fetch', async () => {
    const entitlements = [
      {
        id: '1',
        skuId: '123',
        userId: '456',
        guildId: '789',
        type: 8,
        deleted: false,
        startsAt: null,
        endsAt: null,
      },
    ]
    const fetch = async () => new Map(entitlements.map((row) => [row.id, row]))
    const rows = await fetchAllEntitlementRows({
      application: { entitlements: { fetch } },
    } as never)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ userId: null, guildId: 789n })
  })

  it('paginates a newest-first entitlement listing without skipping rows', async () => {
    const entitlements = Array.from({ length: 150 }, (_, index) => ({
      id: String(index + 1),
      skuId: '123',
      userId: '456',
      guildId: null,
      type: 8,
      deleted: false,
      startsAt: null,
      endsAt: null,
    }))
    const fetch = async (options: {
      limit: number
      before?: string
      after?: string
    }) => {
      const filtered = entitlements
        .filter(
          ({ id }) =>
            (!options.before || BigInt(id) < BigInt(options.before)) &&
            (!options.after || BigInt(id) > BigInt(options.after)),
        )
        .sort((left, right) => Number(BigInt(right.id) - BigInt(left.id)))
        .slice(0, options.limit)
      return new Map(filtered.map((row) => [row.id, row]))
    }

    const rows = await fetchAllEntitlementRows({
      application: { entitlements: { fetch } },
    } as never)

    expect(rows).toHaveLength(150)
    expect(new Set(rows.map((row) => row.id))).toEqual(
      new Set(entitlements.map((row) => BigInt(row.id))),
    )
  })

  it('paginates an oldest-first entitlement listing without skipping rows', async () => {
    const entitlements = Array.from({ length: 150 }, (_, index) => ({
      id: String(index + 1),
      skuId: '123',
      userId: '456',
      guildId: null,
      type: 8,
      deleted: false,
      startsAt: null,
      endsAt: null,
    }))
    const fetch = async (options: {
      limit: number
      before?: string
      after?: string
    }) => {
      const filtered = entitlements
        .filter(
          ({ id }) =>
            (!options.before || BigInt(id) < BigInt(options.before)) &&
            (!options.after || BigInt(id) > BigInt(options.after)),
        )
        .sort((left, right) => Number(BigInt(left.id) - BigInt(right.id)))
        .slice(0, options.limit)
      return new Map(filtered.map((row) => [row.id, row]))
    }

    const rows = await fetchAllEntitlementRows({
      application: { entitlements: { fetch } },
    } as never)

    expect(rows).toHaveLength(150)
    expect(new Set(rows.map((row) => row.id))).toEqual(
      new Set(entitlements.map((row) => BigInt(row.id))),
    )
  })

  it('aborts pagination when a cursor makes no progress', async () => {
    const page = Array.from({ length: 100 }, (_, index) => ({
      id: String(index + 1),
      skuId: '123',
      userId: '456',
      guildId: null,
      type: 8,
      deleted: false,
      startsAt: null,
      endsAt: null,
    }))
    const fetch = async () => new Map(page.map((row) => [row.id, row]))
    await expect(
      fetchAllEntitlementRows({
        application: { entitlements: { fetch } },
      } as never),
    ).rejects.toThrow(/did not advance/)
  })
})

describe('clampLimitOverride', () => {
  it('passes valid integers through', () => {
    expect(clampLimitOverride(0, 50)).toBe(0)
    expect(clampLimitOverride(500, 50)).toBe(500)
    expect(clampLimitOverride(MAX_LIMIT_OVERRIDE, 50)).toBe(MAX_LIMIT_OVERRIDE)
  })

  it('falls back on negative, NaN, and infinite overrides', () => {
    expect(clampLimitOverride(-1, 50)).toBe(50)
    expect(clampLimitOverride(Number.NaN, 50)).toBe(50)
    expect(clampLimitOverride(Number.POSITIVE_INFINITY, 50)).toBe(50)
    expect(clampLimitOverride(Number.NEGATIVE_INFINITY, 50)).toBe(50)
    expect(clampLimitOverride('500' as never, 50)).toBe(50)
  })

  it('floors fractional overrides and rejects out-of-range values', () => {
    expect(clampLimitOverride(9.9, 50)).toBe(9)
    expect(clampLimitOverride(0.5, 50)).toBe(0)
    expect(clampLimitOverride(MAX_LIMIT_OVERRIDE + 1, 50)).toBe(50)
    expect(clampLimitOverride(1e9, 50)).toBe(50)
  })
})

describe.sequential('limitFor OFREP clamp', () => {
  it('falls back to the registry on invalid remote overrides', async () => {
    const { InMemoryProvider } = await import('@openfeature/server-sdk')
    const { closeFeatureFlags, initFeatureFlags } = await import(
      '../src/features/client.mjs'
    )
    const { container } = await import('@sapphire/framework')
    const { silentLogger } = await import('@thesharks/test-utils')
    container.logger = silentLogger
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium'

    const freeCap = getLimit('tags.maxPerGuild', 'free')
    const cases: Array<{ variant: string; value: number }> = [
      { variant: 'negative', value: -5 },
      { variant: 'huge', value: MAX_LIMIT_OVERRIDE + 1 },
      { variant: 'fractional', value: 9.9 },
    ]
    for (const { variant, value } of cases) {
      const provider = new InMemoryProvider({
        'limits.tags.maxPerGuild': {
          disabled: false,
          variants: { [variant]: value },
          defaultVariant: variant,
        },
      })
      await initFeatureFlags({ logger: silentLogger, provider })
      // Fractional values floor; the rest fall back to the registry.
      const expected = variant === 'fractional' ? Math.floor(value) : freeCap
      expect(await limitFor(fakeInteraction([]), 'tags.maxPerGuild')).toBe(
        expected,
      )
    }

    await closeFeatureFlags()
  })

  it('falls back on NaN overrides via the provider', async () => {
    const { InMemoryProvider } = await import('@openfeature/server-sdk')
    const { closeFeatureFlags, initFeatureFlags } = await import(
      '../src/features/client.mjs'
    )
    const { container } = await import('@sapphire/framework')
    const { silentLogger } = await import('@thesharks/test-utils')
    container.logger = silentLogger
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium'

    const freeCap = getLimit('tags.maxPerGuild', 'free')
    const provider = new InMemoryProvider({
      'limits.tags.maxPerGuild': {
        disabled: false,
        variants: { bad: Number.NaN },
        defaultVariant: 'bad',
      },
    })
    await initFeatureFlags({ logger: silentLogger, provider })
    expect(await limitFor(fakeInteraction([]), 'tags.maxPerGuild')).toBe(
      freeCap,
    )
    await closeFeatureFlags()
  })

  it('clamps the demotion-path cap the same way as enforcement', async () => {
    const { InMemoryProvider } = await import('@openfeature/server-sdk')
    const { closeFeatureFlags, initFeatureFlags } = await import(
      '../src/features/client.mjs'
    )
    const { container } = await import('@sapphire/framework')
    const { silentLogger } = await import('@thesharks/test-utils')
    container.logger = silentLogger
    // No SKUs: tier resolves free without touching the database mirror.
    delete process.env.WILDBEAST_PREMIUM_SKUS

    const freeCap = getLimit('tags.maxPromotedPerGuild', 'free')
    const provider = new InMemoryProvider({
      'limits.tags.maxPromotedPerGuild': {
        disabled: false,
        variants: { negative: -10 },
        defaultVariant: 'negative',
      },
    })
    await initFeatureFlags({ logger: silentLogger, provider })
    expect(await capForGuild(500n)).toBe(freeCap)
    await closeFeatureFlags()
  })
})

describe('GateEvaluation tier split (evaluation.mts)', () => {
  it('keeps user subscriptions out of guild enforcement while targeting sees the best tier', async () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium'
    const {
      denialReason,
      evaluateGates,
      isAllowed,
      registerPremiumGate,
      subjectFromInteraction,
    } = await import('../src/features/evaluation.mjs')
    registerPremiumGate('eval-tier-fixture', { scope: 'guild' })

    const userEval = await evaluateGates(
      subjectFromInteraction(fakeInteraction([{ skuId: '123' }])),
      'eval-tier-fixture',
    )
    expect(userEval.tierAny).toBe('premium')
    expect(userEval.tierEnforced).toBe('free')
    expect(userEval.premiumAllowed).toBe(false)
    expect(isAllowed(userEval)).toBe(false)
    expect(denialReason(userEval)).toBe('premium')

    const guildEval = await evaluateGates(
      subjectFromInteraction(
        fakeInteraction([{ skuId: '123', guildId: '500' }]),
      ),
      'eval-tier-fixture',
    )
    expect(guildEval.tierAny).toBe('premium')
    expect(guildEval.tierEnforced).toBe('premium')
    expect(isAllowed(guildEval)).toBe(true)
    expect(denialReason(guildEval)).toBeUndefined()
  })

  it('reports feature denials before premium denials', async () => {
    const { denialReason } = await import('../src/features/evaluation.mjs')
    expect(denialReason({ flagEnabled: false, premiumAllowed: false })).toBe(
      'feature',
    )
    expect(denialReason({ flagEnabled: true, premiumAllowed: false })).toBe(
      'premium',
    )
    expect(
      denialReason({ flagEnabled: true, premiumAllowed: true }),
    ).toBeUndefined()
  })
})

describe('reconcileEntitlements empty-fetch guard', () => {
  it('revokes the whole mirror when a clean fetch returns zero rows', async () => {
    vi.resetModules()
    vi.doMock('@thesharks/drizzle', async () => {
      const actual =
        await vi.importActual<typeof import('@thesharks/drizzle')>(
          '@thesharks/drizzle',
        )
      const returning = async () => [{ id: 1n }]
      return {
        ...actual,
        db: {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: 1n }]),
            })),
          })),
          transaction: vi.fn(async (work: (tx: unknown) => Promise<void>) => {
            await work({
              insert: () => ({
                values: () => ({ onConflictDoUpdate: async () => undefined }),
              }),
              update: () => ({
                set: () => ({ where: () => ({ returning }), returning }),
              }),
            })
          }),
        },
      }
    })
    const sync = await import('../src/premium/sync.mjs')
    const { db } = await import('@thesharks/drizzle')
    const client = {
      application: { entitlements: { fetch: async () => new Map() } },
    } as never

    await expect(sync.reconcileEntitlements(client)).resolves.toBe(0)
    expect(vi.mocked(db.transaction)).toHaveBeenCalledOnce()
    vi.doUnmock('@thesharks/drizzle')
    vi.resetModules()
  })

  it('aborts before any soft-delete when the fetch itself fails', async () => {
    vi.resetModules()
    vi.doMock('@thesharks/drizzle', async () => {
      const actual =
        await vi.importActual<typeof import('@thesharks/drizzle')>(
          '@thesharks/drizzle',
        )
      return {
        ...actual,
        db: {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: 1n }]),
            })),
          })),
          transaction: vi.fn(async () => undefined),
        },
      }
    })
    const sync = await import('../src/premium/sync.mjs')
    const { db } = await import('@thesharks/drizzle')
    const client = {
      application: {
        entitlements: {
          fetch: async () => {
            throw new Error('api is down')
          },
        },
      },
    } as never

    await expect(sync.reconcileEntitlements(client)).rejects.toThrow(
      /api is down/,
    )
    expect(vi.mocked(db.transaction)).not.toHaveBeenCalled()
    vi.doUnmock('@thesharks/drizzle')
    vi.resetModules()
  })

  it('resolves zero without touching the mirror when both sides are empty', async () => {
    vi.resetModules()
    vi.doMock('@thesharks/drizzle', async () => {
      const actual =
        await vi.importActual<typeof import('@thesharks/drizzle')>(
          '@thesharks/drizzle',
        )
      return {
        ...actual,
        db: {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
          })),
          transaction: vi.fn(async () => undefined),
        },
      }
    })
    const sync = await import('../src/premium/sync.mjs')
    const { db } = await import('@thesharks/drizzle')
    const client = {
      application: { entitlements: { fetch: async () => new Map() } },
    } as never

    await expect(sync.reconcileEntitlements(client)).resolves.toBe(0)
    expect(vi.mocked(db.transaction)).not.toHaveBeenCalled()
    vi.doUnmock('@thesharks/drizzle')
    vi.resetModules()
  })
})
