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
  'tags.maxPromotedPerGuild': {
    description: 'Tags a guild may promote to guild slash commands',
    scope: 'guild',
    // Discord allows 100 guild commands per app; the premium cap stays far
    // below so promoted tags never crowd out the daily create budget.
    values: { free: 2, premium: 25 },
  },
} as const satisfies Record<string, LimitDefinition>

export type LimitKey = keyof typeof registry
export type LimitFlagKey = `limits.${LimitKey}`

export const limitKeys = Object.keys(registry) as LimitKey[]

/** The cap for `key` at `tier`. Compare with `Number.isFinite` first when a
 * tier may be UNLIMITED. */
export function getLimit(key: LimitKey, tier: PremiumTier): number {
  return registry[key].values[tier]
}

/** Upper bound for remote limit overrides. The registry is trusted; the flag
 * service is not — values above this fall back to the registry. */
export const MAX_LIMIT_OVERRIDE = 10_000

/**
 * Clamp a remote limit override to the enforceable range: finite, >= 0,
 * floored to an integer, and at most MAX_LIMIT_OVERRIDE. Anything else
 * falls back to the registry value for the resolved tier (which may itself
 * be UNLIMITED). Pure so enforcement (limitFor) and demotion (capForGuild)
 * share one rule; callers warn + record a metric on fallback.
 */
export function clampLimitOverride(raw: unknown, fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback
  const floored = Math.floor(raw)
  if (floored < 0 || floored > MAX_LIMIT_OVERRIDE) return fallback
  return floored
}

/** Whether `raw` is usable as a limit override without falling back. */
export function isValidLimitOverride(raw: unknown): raw is number {
  return (
    typeof raw === 'number' &&
    Number.isFinite(raw) &&
    Math.floor(raw) === raw &&
    raw >= 0 &&
    raw <= MAX_LIMIT_OVERRIDE
  )
}

export function limitFlagKey(key: LimitKey): LimitFlagKey {
  return `limits.${key}`
}

/** The registry entry itself, for surfaces that display limits (e.g. a
 * future /premium status command). */
export function describeLimit(key: LimitKey): LimitDefinition {
  return registry[key]
}
