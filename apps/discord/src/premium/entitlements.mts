import { container } from '@sapphire/framework'
import { metrics } from '@thesharks/analytics'
import {
  and,
  db,
  entitlements,
  eq,
  gt,
  isNull,
  lte,
  or,
  type SQL,
  sql,
} from '@thesharks/drizzle'
import type { BaseInteraction, Entitlement } from 'discord.js'
import { limitFlagValue } from '../features/client.mjs'
import {
  interactionFlagContext,
  taskFlagContext,
} from '../features/context.mjs'
import {
  clampLimitOverride,
  describeLimit,
  getLimit,
  type LimitKey,
  limitFlagKey,
} from './limits.mjs'
import { premiumSkuMap } from './skus.mjs'
import {
  FREE_TIER,
  highestTier,
  type PremiumScope,
  type PremiumTier,
} from './tiers.mjs'

const meter = metrics.getMeter('@thesharks/discord')
/** Remote limit overrides that failed validation and fell back to the
 * registry, by limit key. */
export const limitOverrideFallbackCounter = meter.createCounter(
  'discord_premium_limit_override_fallbacks_total',
  { description: 'Remote limit overrides rejected as invalid' },
)

/**
 * Tier resolution from interactions. Discord attaches every applicable
 * active entitlement (the invoker's user subscriptions and the guild's
 * subscriptions) to each interaction, so these are synchronous, always
 * fresh, and need no caching — prefer them over the database variants
 * whenever an interaction is at hand. An entitlement's own shape decides
 * its scope: guildId set means guild subscription, unset means user
 * subscription.
 */

/** The tier the invoker's own subscriptions grant, wherever they are. */
export function userTierForInteraction(
  interaction: BaseInteraction,
): PremiumTier {
  return grantedByInteraction(
    interaction,
    (entitlement) => entitlement.guildId === null,
  )
}

/** The tier the current guild's subscriptions grant; free in DMs. */
export function guildTierForInteraction(
  interaction: BaseInteraction,
): PremiumTier {
  if (!interaction.guildId) return FREE_TIER
  return grantedByInteraction(
    interaction,
    (entitlement) => entitlement.guildId === interaction.guildId,
  )
}

/** The best tier from either scope — for perks where any subscription
 * (the invoker's own or the guild's) should count. This is the `anyTier`:
 * commandFlagContext (features/commandContext.mjs) reports it as `tier`
 * for gate targeting. Limit evaluation must NOT use it directly — use
 * enforcementTier below so a user subscription can't lift a guild cap. */
export function tierForInteraction(interaction: BaseInteraction): PremiumTier {
  return highestTier([
    userTierForInteraction(interaction),
    guildTierForInteraction(interaction),
  ])
}

/**
 * The tier that enforces `scope` for `interaction`: the invoker's own for
 * 'user' limits, the current guild's (free in DMs) for 'guild' limits, the
 * best of either for 'any' limits. limitFor and upsellForLimit resolve
 * through here so scope handling stays in one place; commandContext.mts
 * re-exports it for limit call sites that need a scope-resolved tier.
 */
export function enforcementTier(
  interaction: BaseInteraction,
  scope: PremiumScope | 'any',
): PremiumTier {
  return {
    user: userTierForInteraction,
    guild: guildTierForInteraction,
    any: tierForInteraction,
  }[scope](interaction)
}

/** Warn once per invalid override without letting logging break the call. */
function warnInvalidOverride(key: LimitKey, raw: unknown, fallback: number) {
  try {
    container.logger.warn(
      `Invalid limit override for ${limitFlagKey(key)}: ${String(raw)}; using registry fallback ${fallback}`,
    )
  } catch {
    // Logging must never break limit enforcement.
  }
  try {
    limitOverrideFallbackCounter.add(1, { key })
  } catch {
    // Metrics must never break limit enforcement either.
  }
}

/**
 * The cap for `key` at the invoker's tier — the one-call form commands use.
 * The registry entry's scope decides whose subscription counts: the
 * invoker's own for 'user' limits, the current guild's for 'guild' limits,
 * the best of either for 'any' limits.
 *
 * When an OFREP flag service is configured (features/client.mjs), the
 * registry value becomes the default of the `limits.<key>` flag and the
 * service can override it by any dimension of the context — a guild, a
 * user, a tier, an environment — or unconditionally for a global change.
 * Without a service, or when it's unreachable or has no rule, the registry
 * value stands.
 */
export async function limitFor(
  interaction: BaseInteraction,
  key: LimitKey,
): Promise<number> {
  const definition = describeLimit(key)
  const tier = enforcementTier(interaction, definition.scope)
  const fallback = getLimit(key, tier)
  const raw = await limitFlagValue(
    limitFlagKey(key),
    fallback,
    interactionFlagContext(interaction, {
      tier,
      targetingKey:
        definition.scope === 'user'
          ? interaction.user.id
          : (interaction.guildId ?? interaction.user.id),
    }),
  )
  const clamped = clampLimitOverride(raw, fallback)
  if (clamped !== raw) warnInvalidOverride(key, raw, fallback)
  return clamped
}

/**
 * The validated cap for a guild outside interactions (the demotion path).
 * Mirrors the reconcile task's capForGuild: resolve the mirrored tier, read
 * the same `limits.*` flag with the registry value as default, then clamp
 * the override exactly like limitFor. Shared clamp keeps enforcement and
 * demotion from diverging — an operator override that enforcement ignores
 * must not demote either.
 */
export async function capForGuild(
  guildId: bigint,
  key: LimitKey = 'tags.maxPromotedPerGuild',
  taskName = 'guildTagCommandReconcile',
): Promise<number> {
  const tier = await tierForGuild(guildId)
  const fallback = getLimit(key, tier)
  const raw = await limitFlagValue(limitFlagKey(key), fallback, {
    ...taskFlagContext(taskName),
    targetingKey: guildId.toString(),
    guildId: guildId.toString(),
    tier,
  })
  const clamped = clampLimitOverride(raw, fallback)
  if (clamped !== raw) warnInvalidOverride(key, raw, fallback)
  return clamped
}

function grantedByInteraction(
  interaction: BaseInteraction,
  applies: (entitlement: Entitlement) => boolean,
): PremiumTier {
  const skus = premiumSkuMap()
  if (skus.size === 0) return FREE_TIER

  const tiers: PremiumTier[] = []
  for (const entitlement of interaction.entitlements.values()) {
    if (!entitlement.isActive() || !applies(entitlement)) continue
    const sku = skus.get(entitlement.skuId)
    if (sku) tiers.push(sku.tier)
  }
  return highestTier(tiers)
}

/** Rows that grant something right now: not soft-deleted and inside their
 * validity window (null bounds mean perpetual, e.g. test entitlements). */
const activeNow = and(
  eq(entitlements.deleted, false),
  or(isNull(entitlements.startsAt), lte(entitlements.startsAt, sql`now()`)),
  or(isNull(entitlements.endsAt), gt(entitlements.endsAt, sql`now()`)),
)

/**
 * The tier a guild's subscriptions grant, from the locally mirrored
 * entitlements. For contexts without an interaction (scheduled tasks,
 * background jobs); accuracy depends on the sync listeners having run.
 */
export async function tierForGuild(guildId: bigint): Promise<PremiumTier> {
  return grantedFromMirror(and(eq(entitlements.guildId, guildId), activeNow))
}

/**
 * The tier a user's own subscriptions grant, from the locally mirrored
 * entitlements. Guild subscriptions don't count here: they benefit the
 * guild, not the buyer personally.
 */
export async function tierForUser(userId: bigint): Promise<PremiumTier> {
  return grantedFromMirror(
    and(
      eq(entitlements.userId, userId),
      isNull(entitlements.guildId),
      activeNow,
    ),
  )
}

async function grantedFromMirror(where: SQL | undefined): Promise<PremiumTier> {
  const skus = premiumSkuMap()
  if (skus.size === 0) return FREE_TIER

  const rows = await db
    .select({ skuId: entitlements.skuId })
    .from(entitlements)
    .where(where)
  return highestTier(
    rows.flatMap((row) => skus.get(row.skuId.toString())?.tier ?? []),
  )
}
