/**
 * Premium tiers in ascending order of privilege. The first entry is the
 * baseline every user and guild has; later entries are granted by active
 * Discord entitlements for the SKUs configured in WILDBEAST_PREMIUM_SKUS.
 * Adding a tier here means giving it a value for every limit in
 * premium/limits.mts (the compiler enforces this).
 */
export const PREMIUM_TIERS = ['free', 'premium'] as const

export type PremiumTier = (typeof PREMIUM_TIERS)[number]

/**
 * Who a subscription benefits. Discord sells both kinds: user subscriptions
 * follow the buyer everywhere, guild subscriptions benefit one guild and
 * everyone in it. An entitlement's own shape (guildId set or not) decides
 * its scope; limits and preconditions declare which scope they respect.
 */
export type PremiumScope = 'user' | 'guild'

/** The baseline tier used when no entitlement applies. */
export const FREE_TIER: PremiumTier = PREMIUM_TIERS[0]

export function isPremiumTier(value: string): value is PremiumTier {
  return (PREMIUM_TIERS as readonly string[]).includes(value)
}

/** Whether `tier` grants at least the privileges of `minimum`. */
export function tierAtLeast(tier: PremiumTier, minimum: PremiumTier): boolean {
  return PREMIUM_TIERS.indexOf(tier) >= PREMIUM_TIERS.indexOf(minimum)
}

/**
 * The most privileged tier among `tiers`; the free baseline when the
 * iterable is empty. Entitlement lookups can yield several tiers (a user
 * subscription and a guild subscription at once) — the best one wins.
 */
export function highestTier(tiers: Iterable<PremiumTier>): PremiumTier {
  let best = FREE_TIER
  for (const tier of tiers) {
    if (tierAtLeast(tier, best)) {
      best = tier
    }
  }
  return best
}
