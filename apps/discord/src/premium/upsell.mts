import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import type { PremiumSku } from '../premium/skus.mjs'
import {
  describeLimit,
  type LimitKey,
  tierAtLeast,
  tierRaisingLimit,
} from './limits.mjs'
import type { Scope, Tier } from './model.mjs'

export type SkuCatalog = ReadonlyMap<string, PremiumSku>

/** Cheapest SKU granting `tier` for `scope`; undefined omits the purchase button. */
export function skuIdForTier(
  catalog: SkuCatalog,
  tier: Tier,
  scope: Scope | 'any' = 'any',
): string | undefined {
  let best: { skuId: string; sku: PremiumSku } | undefined
  for (const [skuId, sku] of catalog) {
    if (!tierAtLeast(sku.tier, tier)) continue
    if (scope !== 'any' && sku.scope !== 'any' && sku.scope !== scope) continue
    if (best === undefined) {
      best = { skuId, sku }
      continue
    }
    const cheaper = !tierAtLeast(sku.tier, best.sku.tier)
    const sameTier = sku.tier === best.sku.tier
    const moreExact = sku.scope === scope && best.sku.scope !== scope
    if (cheaper || (sameTier && moreExact)) best = { skuId, sku }
  }
  return best?.skuId
}

/** Purchase button for `tier`; DM replies never offer guild SKUs. */
export function premiumUpsellComponents(
  catalog: SkuCatalog,
  tier: Tier,
  scope: Scope | 'any' = 'any',
  guildId: bigint | null = null,
): ActionRowBuilder<ButtonBuilder>[] | undefined {
  const effectiveScope = guildId === null && scope === 'any' ? 'user' : scope
  if (guildId === null && effectiveScope === 'guild') return undefined
  const skuId = skuIdForTier(catalog, tier, effectiveScope)
  if (!skuId) return undefined
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Premium).setSKUId(skuId),
    ),
  ]
}

/** Button for limit replies; undefined when no higher tier raises the cap. */
export function upsellForLimit(
  catalog: SkuCatalog,
  key: LimitKey,
  currentTier: Tier,
  guildId: bigint | null,
): ActionRowBuilder<ButtonBuilder>[] | undefined {
  const definition = describeLimit(key)
  if (guildId === null && definition.scope === 'guild') return undefined
  const target = tierRaisingLimit(key, currentTier)
  if (!target) return undefined
  return premiumUpsellComponents(catalog, target, definition.scope, guildId)
}
