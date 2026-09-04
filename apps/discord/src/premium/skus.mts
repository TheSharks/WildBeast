import {
  isPremiumTier,
  PREMIUM_TIERS,
  type PremiumScope,
  type PremiumTier,
  tierAtLeast,
} from './tiers.mjs'

export interface PremiumSku {
  /** The tier an active entitlement for this SKU grants. */
  tier: PremiumTier
  /** Declared sale scope; only used to pick the right SKU for denial upsells. */
  scope: PremiumScope | 'any'
}

const SCOPES: ReadonlyArray<PremiumSku['scope']> = ['user', 'guild', 'any']

// Parse `skuId:tier[:scope]` list; throws readable errors for boot validation.
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
    if (!/^\d+$/.test(skuId)) {
      throw new Error(`Premium SKU id "${skuId}" is not a snowflake`)
    }
    if (!isPremiumTier(tier)) {
      throw new Error(
        `Unknown premium tier "${tier}"; known tiers: ${PREMIUM_TIERS.join(', ')}`,
      )
    }
    if (!SCOPES.includes(scope as PremiumSku['scope'])) {
      throw new Error(
        `Unknown premium scope "${scope}"; expected user, guild, or any`,
      )
    }
    if (map.has(skuId)) {
      throw new Error(`Premium SKU ${skuId} is listed more than once`)
    }
    map.set(skuId, { tier, scope: scope as PremiumSku['scope'] })
  }
  return map
}

let cachedRaw: string | undefined
let cachedMap: Map<string, PremiumSku> | undefined

// Configured SKU map; empty means premium off. Cached per value for the interaction hot path.
export function premiumSkuMap(
  env: NodeJS.ProcessEnv = process.env,
): Map<string, PremiumSku> {
  const raw = env.WILDBEAST_PREMIUM_SKUS
  if (cachedMap === undefined || raw !== cachedRaw) {
    cachedMap = parsePremiumSkus(raw)
    cachedRaw = raw
  }
  return cachedMap
}

// Cheapest SKU granting `tier` for `scope`; undefined omits the purchase button.
export function skuIdForTier(
  tier: PremiumTier,
  scope: PremiumScope | 'any' = 'any',
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  let best: { skuId: string; sku: PremiumSku } | undefined
  for (const [skuId, sku] of premiumSkuMap(env)) {
    if (!tierAtLeast(sku.tier, tier)) continue
    if (scope !== 'any' && sku.scope !== 'any' && sku.scope !== scope) continue
    if (best === undefined) {
      best = { skuId, sku }
      continue
    }
    const cheaper = !tierAtLeast(sku.tier, best.sku.tier)
    const sameTier = sku.tier === best.sku.tier
    const moreExact = sku.scope === scope && best.sku.scope !== scope
    if (cheaper || (sameTier && moreExact)) {
      best = { skuId, sku }
    }
  }
  return best?.skuId
}
