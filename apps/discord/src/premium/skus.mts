import type { Scope, Tier } from './model.mjs'

export interface PremiumSku {
  /** The tier an active entitlement for this SKU grants. */
  tier: Tier
  /** Declared sale scope; only used to pick the right SKU for upsells. */
  scope: Scope | 'any'
}

const TIERS: readonly string[] = ['free', 'premium']
const SCOPES: readonly string[] = ['user', 'guild', 'any']

/** Parse `skuId:tier[:scope]` entries; throws readable errors for boot validation. */
export function parsePremiumSkus(
  raw: string | undefined,
): Map<string, PremiumSku> {
  const map = new Map<string, PremiumSku>()
  if (!raw) return map
  for (const entry of raw.split(',')) {
    const [skuId, tier, scope = 'any', ...rest] = entry
      .split(':')
      .map((part) => part.trim())
    if (!skuId || !tier || rest.length > 0) {
      throw new Error(
        `Malformed premium SKU entry "${entry}": expected "skuId:tier" or "skuId:tier:scope"`,
      )
    }
    if (!/^\d+$/.test(skuId))
      throw new Error(`Premium SKU id "${skuId}" is not a snowflake`)
    if (!TIERS.includes(tier)) {
      throw new Error(
        `Unknown premium tier "${tier}"; known tiers: ${TIERS.join(', ')}`,
      )
    }
    if (!SCOPES.includes(scope)) {
      throw new Error(
        `Unknown premium scope "${scope}"; expected user, guild, or any`,
      )
    }
    if (map.has(skuId))
      throw new Error(`Premium SKU ${skuId} is listed more than once`)
    map.set(skuId, { tier: tier as Tier, scope: scope as PremiumSku['scope'] })
  }
  return map
}
