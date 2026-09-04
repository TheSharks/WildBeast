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
  /**
   * The subscription kind the SKU is sold as in the developer portal. Tier
   * resolution trusts the entitlement's own shape, not this — the scope
   * exists so denial replies can offer the right SKU to purchase. 'any'
   * (the default when omitted) matches every scope.
   */
  scope: PremiumScope | 'any'
}

const SCOPES: ReadonlyArray<PremiumSku['scope']> = ['user', 'guild', 'any']

/**
 * Parse a WILDBEAST_PREMIUM_SKUS value: comma-separated `skuId:tier` or
 * `skuId:tier:scope` entries, e.g. `1315790123456789:premium:guild`. SKU
 * ids come from the Discord developer portal's monetization tab; tiers must
 * exist in PREMIUM_TIERS and scope is user or guild. Throws with a readable
 * message on malformed input so boot validation can surface it.
 */
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

/**
 * The configured SKU mapping. Empty when premium is not configured, in
 * which case everything runs at the free tier and premium-gated commands
 * deny with a plain message (no purchase button). Parsed once per distinct
 * value: tier resolution consults this several times per interaction (gate
 * context, precondition, limit lookup), so it must stay allocation-free on
 * the hot path.
 */
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

/**
 * A purchasable SKU that grants at least `tier` for `scope`. Prefers the
 * cheapest (lowest) sufficient tier, and among equals a SKU declared for
 * exactly that scope over an 'any' one. Feeds the premium-style purchase
 * button on denial replies; undefined means no SKU fits and the button is
 * omitted.
 */
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
