import {
  ActionRowBuilder,
  type BaseInteraction,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js'
import {
  guildTierForInteraction,
  tierForInteraction,
  userTierForInteraction,
} from './entitlements.mjs'
import { describeLimit, getLimit, type LimitKey } from './limits.mjs'
import { skuIdForTier } from './skus.mjs'
import {
  PREMIUM_TIERS,
  type PremiumScope,
  type PremiumTier,
  tierAtLeast,
} from './tiers.mjs'

// Purchase button for `tier`; undefined omits it. Pass guildId so DM replies never offer guild SKUs.
export function premiumUpsellComponents(
  tier: PremiumTier,
  scope: PremiumScope | 'any' = 'any',
  guildId?: string | null,
): ActionRowBuilder<ButtonBuilder>[] | undefined {
  const effectiveScope =
    guildId === null && scope === 'any' ? ('user' as const) : scope
  if (guildId === null && effectiveScope === 'guild') return undefined
  const skuId = skuIdForTier(tier, effectiveScope)
  if (!skuId) return undefined
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Premium).setSKUId(skuId),
    ),
  ]
}

// Button for limit replies; undefined when no higher tier raises the cap or no SKU fits.
export function upsellForLimit(
  interaction: BaseInteraction,
  key: LimitKey,
): ActionRowBuilder<ButtonBuilder>[] | undefined {
  const definition = describeLimit(key)
  // Guild caps are free in DMs where guild SKUs can't be bought; stay informational.
  if (!interaction.guildId && definition.scope === 'guild') return undefined
  const resolve = {
    user: userTierForInteraction,
    guild: guildTierForInteraction,
    any: tierForInteraction,
  }[definition.scope]
  const tier = resolve(interaction)
  const target = tierRaisingLimit(key, tier)
  if (!target) return undefined
  return premiumUpsellComponents(target, definition.scope, interaction.guildId)
}

// Lowest tier above `tier` raising `key`, if any.
function tierRaisingLimit(
  key: LimitKey,
  tier: PremiumTier,
): PremiumTier | undefined {
  const current = getLimit(key, tier)
  return PREMIUM_TIERS.find(
    (candidate) =>
      !tierAtLeast(tier, candidate) && getLimit(key, candidate) > current,
  )
}
