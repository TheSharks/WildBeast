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

/**
 * A premium-style button opening Discord's purchase flow for the SKU that
 * grants `tier`. Undefined when no configured SKU fits, in which case the
 * surrounding message is just informational — callers can pass the result
 * straight to a reply's `components`.
 */
export function premiumUpsellComponents(
  tier: PremiumTier,
  scope: PremiumScope | 'any' = 'any',
): ActionRowBuilder<ButtonBuilder>[] | undefined {
  const skuId = skuIdForTier(tier, scope)
  if (!skuId) return undefined
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Premium).setSKUId(skuId),
    ),
  ]
}

/**
 * The purchase button to attach to a limit-reached reply, or undefined when
 * upselling makes no sense: no higher tier raises this cap (the invoker
 * already holds the best applicable subscription) or no purchasable SKU is
 * configured. Keeps "you hit the cap" honest — a premium guild at its
 * premium cap must not be asked to buy premium again.
 */
export function upsellForLimit(
  interaction: BaseInteraction,
  key: LimitKey,
): ActionRowBuilder<ButtonBuilder>[] | undefined {
  const definition = describeLimit(key)
  const resolve = {
    user: userTierForInteraction,
    guild: guildTierForInteraction,
    any: tierForInteraction,
  }[definition.scope]
  const tier = resolve(interaction)
  const target = tierRaisingLimit(key, tier)
  if (!target) return undefined
  return premiumUpsellComponents(target, definition.scope)
}

/** The lowest tier above `tier` with a higher cap for `key`, if any. */
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
