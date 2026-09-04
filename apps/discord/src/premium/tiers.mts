// Tiers ascending; first is baseline. New tiers need values for every limit (compiler-enforced).
export const PREMIUM_TIERS = ['free', 'premium'] as const

export type PremiumTier = (typeof PREMIUM_TIERS)[number]

// Benefit scope; entitlement shape (guildId set or not) decides it.
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

// Best tier in `tiers`; free when empty.
export function highestTier(tiers: Iterable<PremiumTier>): PremiumTier {
  let best = FREE_TIER
  for (const tier of tiers) {
    if (tierAtLeast(tier, best)) {
      best = tier
    }
  }
  return best
}
