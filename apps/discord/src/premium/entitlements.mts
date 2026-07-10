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
import { interactionFlagContext } from '../features/context.mjs'
import {
  describeLimit,
  getLimit,
  type LimitKey,
  limitFlagKey,
} from './limits.mjs'
import { premiumSkuMap } from './skus.mjs'
import { FREE_TIER, highestTier, type PremiumTier } from './tiers.mjs'

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
 * (the invoker's own or the guild's) should count. */
export function tierForInteraction(interaction: BaseInteraction): PremiumTier {
  return highestTier([
    userTierForInteraction(interaction),
    guildTierForInteraction(interaction),
  ])
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
  const resolve = {
    user: userTierForInteraction,
    guild: guildTierForInteraction,
    any: tierForInteraction,
  }[definition.scope]
  const tier = resolve(interaction)
  const fallback = getLimit(key, tier)
  return limitFlagValue(
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
