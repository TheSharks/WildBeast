import type { PremiumScope, PremiumTier } from './tiers.mjs'

/** Sentinel for tiers where a limit does not apply at all. */
export const UNLIMITED = Number.POSITIVE_INFINITY

interface LimitDefinition {
  /** What the limit caps, for humans reading this registry. */
  description: string
  /** Whose subscription raises the cap ('guild' is free in DMs; 'any' takes the best). */
  scope: PremiumScope | 'any'
  /** Cap per tier; list every tier. */
  values: Record<PremiumTier, number>
}

// All subscription-controlled limits; key convention `<feature>.<limit>`. No tier numbers elsewhere.
const registry = {
  'tags.maxPerGuild': {
    description: 'Tags a guild may hold',
    scope: 'guild',
    values: { free: 50, premium: 500 },
  },
  'tags.maxPromotedPerGuild': {
    description: 'Tags a guild may promote to guild slash commands',
    scope: 'guild',
    // Stays far below Discord's 100-command cap.
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

// Upper bound for remote overrides; the registry is trusted, the flag service is not.
export const MAX_LIMIT_OVERRIDE = 10_000

// Clamp remote overrides to [0, MAX_LIMIT_OVERRIDE] ints; fallback keeps enforcement and demotion aligned.
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

// Registry entry for limit-display surfaces.
export function describeLimit(key: LimitKey): LimitDefinition {
  return registry[key]
}
