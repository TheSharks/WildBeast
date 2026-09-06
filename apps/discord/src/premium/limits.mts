import type { Scope, Tier } from './model.mjs'

export const TIERS: readonly Tier[] = ['free', 'premium']

export interface LimitDefinition {
  description: string
  /** Whose subscription raises the cap; guild caps are free in DMs. */
  scope: Scope
  values: Record<Tier, number>
}

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

export function getLimit(key: LimitKey, tier: Tier): number {
  return registry[key].values[tier]
}

export function describeLimit(key: LimitKey): LimitDefinition {
  return registry[key]
}

export function limitFlagKey(key: LimitKey): LimitFlagKey {
  return `limits.${key}`
}

/** The flag service is not trusted to raise a cap without bound. */
export const MAX_LIMIT_OVERRIDE = 10_000

export function clampLimitOverride(raw: unknown, fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback
  const floored = Math.floor(raw)
  if (floored < 0 || floored > MAX_LIMIT_OVERRIDE) return fallback
  return floored
}

export function tierAtLeast(tier: Tier, minimum: Tier): boolean {
  return TIERS.indexOf(tier) >= TIERS.indexOf(minimum)
}

/** Lowest tier above `tier` that raises `key`, if any. */
export function tierRaisingLimit(key: LimitKey, tier: Tier): Tier | undefined {
  const current = getLimit(key, tier)
  return TIERS.find(
    (candidate) =>
      !tierAtLeast(tier, candidate) && getLimit(key, candidate) > current,
  )
}
