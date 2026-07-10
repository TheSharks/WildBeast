import type { PremiumScope, PremiumTier } from './tiers.mjs'

/** Sentinel for tiers where a limit does not apply at all. */
export const UNLIMITED = Number.POSITIVE_INFINITY

interface LimitDefinition {
  /** What the limit caps, for humans reading this registry. */
  description: string
  /**
   * Whose subscription raises the cap: 'user' limits follow the invoker's
   * own subscription, 'guild' limits follow the subscription of the guild
   * the interaction happens in (free tier in DMs), and 'any' limits take
   * the best of both — the right choice for per-user caps that a guild
   * subscription should also lift, e.g. in guild-subs-only deployments.
   */
  scope: PremiumScope | 'any'
  /** The cap per tier; every tier must be listed so raising a tier never
   * accidentally falls back to a stricter default. */
  values: Record<PremiumTier, number>
}

/**
 * Every subscription-controlled limit in the bot, in one place. Features
 * look their cap up by key (`limitFor` in premium/entitlements.mjs resolves
 * the invoker's tier first); nothing outside this file hardcodes a
 * tier-dependent number. Key convention: `<feature>.<limit>`.
 */
const registry = {
  'tags.maxPerGuild': {
    description: 'Tags a guild may hold',
    scope: 'guild',
    values: { free: 50, premium: 500 },
  },
} as const satisfies Record<string, LimitDefinition>

export type LimitKey = keyof typeof registry

export const limitKeys = Object.keys(registry) as LimitKey[]

/** The cap for `key` at `tier`. Compare with `Number.isFinite` first when a
 * tier may be UNLIMITED. */
export function getLimit(key: LimitKey, tier: PremiumTier): number {
  return registry[key].values[tier]
}

/** The registry entry itself, for surfaces that display limits (e.g. a
 * future /premium status command). */
export function describeLimit(key: LimitKey): LimitDefinition {
  return registry[key]
}
