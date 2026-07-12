import { snapshotEnv } from '@thesharks/test-utils'
import type { ButtonBuilder } from 'discord.js'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
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
})
