import { snapshotEnv } from '@thesharks/test-utils'
import type { ButtonBuilder } from 'discord.js'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { premiumDenialDetail } from '../src/listeners/reporting/commandDeniedReply.mjs'
import {
  premiumUpsellComponents,
  upsellForLimit,
} from '../src/premium/upsell.mjs'

const restoreEnv = snapshotEnv(['WILDBEAST_PREMIUM_SKUS'])
afterEach(() => {
  delete process.env.WILDBEAST_PREMIUM_SKUS
})
afterAll(restoreEnv)

interface FakeEntitlement {
  skuId: string
  guildId?: string
}

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
          isActive: () => true,
        },
      ]),
    ),
  } as never
}

function buttonSkuId(
  components: ReturnType<typeof premiumUpsellComponents>,
): string | undefined {
  const button = components?.[0]?.components[0] as ButtonBuilder | undefined
  return (button?.toJSON() as { sku_id?: string } | undefined)?.sku_id
}

describe('premiumUpsellComponents', () => {
  it('returns nothing when no SKU is configured', () => {
    expect(premiumUpsellComponents('premium')).toBeUndefined()
  })

  it('builds a premium button for the SKU granting the tier', () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium:guild'
    expect(buttonSkuId(premiumUpsellComponents('premium', 'guild'))).toBe('123')
  })
})

describe('upsellForLimit', () => {
  it('offers the purchase button to guilds below the cap-raising tier', () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium:guild'
    const components = upsellForLimit(fakeInteraction([]), 'tags.maxPerGuild')
    expect(buttonSkuId(components)).toBe('123')
  })

  it('never upsells a guild that already holds the best tier for the cap', () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium:guild'
    const components = upsellForLimit(
      fakeInteraction([{ skuId: '123', guildId: '500' }]),
      'tags.maxPerGuild',
    )
    expect(components).toBeUndefined()
  })

  it('ignores the invoker’s user subscription for guild-scoped limits', () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium'
    // A user subscription doesn't raise a guild cap, so the upsell stands.
    const components = upsellForLimit(
      fakeInteraction([{ skuId: '123' }]),
      'tags.maxPerGuild',
    )
    expect(buttonSkuId(components)).toBe('123')
  })

  it('stays silent when no purchasable SKU exists', () => {
    expect(
      upsellForLimit(fakeInteraction([]), 'tags.maxPerGuild'),
    ).toBeUndefined()
  })

  it('suppresses guild-SKU buttons in DMs', () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium:guild'
    // Guild caps are free tier in DMs; a guild purchase button there can't
    // be bought in context.
    expect(
      upsellForLimit(fakeInteraction([], null), 'tags.maxPerGuild'),
    ).toBeUndefined()
    expect(premiumUpsellComponents('premium', 'guild', null)).toBeUndefined()
  })

  it('resolves an any-scope request in DMs to a user SKU', () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '111:premium:user,222:premium:guild'
    // In DMs the guild SKU must never render; the user SKU still may.
    expect(buttonSkuId(premiumUpsellComponents('premium', 'any', null))).toBe(
      '111',
    )
    // Outside DMs the exact-scope preference still applies.
    expect(
      buttonSkuId(premiumUpsellComponents('premium', 'any', '500')),
    ).toBeDefined()
  })

  it('keeps guild upsells in guilds', () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium:guild'
    expect(
      buttonSkuId(premiumUpsellComponents('premium', 'guild', '500')),
    ).toBe('123')
  })
})

describe('premiumDenialDetail (scope-aware denial copy)', () => {
  it('names the server for guild gates in guilds', () => {
    const copy = premiumDenialDetail({ guildId: '500' }, 'premium', 'guild')
    expect(copy).toMatch(/server/i)
    expect(copy).toContain('premium')
    expect(copy).toMatch(/guild/)
  })

  it('says guild gates cannot pass in DMs', () => {
    const copy = premiumDenialDetail({ guildId: null }, 'premium', 'guild')
    expect(copy).toMatch(/DM/)
    expect(copy).toContain('premium')
  })

  it('names the invoker for user gates', () => {
    const copy = premiumDenialDetail({ guildId: '500' }, 'premium', 'user')
    expect(copy).toMatch(/you need/i)
    expect(copy).toContain('premium')
    expect(copy).toMatch(/user/)
  })

  it('names both for any gates in guilds and only the user in DMs', () => {
    expect(premiumDenialDetail({ guildId: '500' }, 'premium', 'any')).toMatch(
      /you or this server/i,
    )
    expect(premiumDenialDetail({ guildId: null }, 'premium', 'any')).toMatch(
      /you need/i,
    )
  })
})
