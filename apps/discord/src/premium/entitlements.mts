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
import type { BaseInteraction } from 'discord.js'
import { limitFlagValue } from '../features/client.mjs'
import {
  interactionFlagContext,
  taskFlagContext,
} from '../features/context.mjs'
import {
  guildTierForSubject,
  subjectFromInteraction,
  tierAny,
  tierEnforced,
  userTierForSubject,
} from '../features/evaluation.mjs'
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
// Rejected remote limit overrides by key.
export const limitOverrideFallbackCounter = meter.createCounter(
  'discord_premium_limit_override_fallbacks_total',
  { description: 'Remote limit overrides rejected as invalid' },
)

// Interaction tiers are synchronous and fresh (Discord attaches all entitlements); prefer over DB.
// Tier math lives in evaluation.mts; these stay as interaction-shaped aliases.

// Invoker's own tier, anywhere.
export function userTierForInteraction(
  interaction: BaseInteraction,
): PremiumTier {
  return userTierForSubject(subjectFromInteraction(interaction))
}

// Current guild's tier; free in DMs.
export function guildTierForInteraction(
  interaction: BaseInteraction,
): PremiumTier {
  return guildTierForSubject(subjectFromInteraction(interaction))
}

// Best of either scope for gate targeting; never for limits (use enforcementTier below).
export function tierForInteraction(interaction: BaseInteraction): PremiumTier {
  return tierAny(subjectFromInteraction(interaction))
}

// Scope-resolved tier for enforcement; single place for scope handling.
export function enforcementTier(
  interaction: BaseInteraction,
  scope: PremiumScope | 'any',
): PremiumTier {
  return tierEnforced(subjectFromInteraction(interaction), scope)
}

// Warn on invalid overrides; logging/metrics must never break enforcement.
function warnInvalidOverride(key: LimitKey, raw: unknown, fallback: number) {
  try {
    container.logger.warn(
      `Invalid limit override for ${limitFlagKey(key)}: ${String(raw)}; using registry fallback ${fallback}`,
    )
  } catch {
    // Never break enforcement.
  }
  try {
    limitOverrideFallbackCounter.add(1, { key })
  } catch {
    // Never break enforcement.
  }
}

// Cap for `key` at the invoker's tier; registry value is the flag default, remotely overridable.
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

// Validated guild cap for non-interaction paths; shared clamp keeps enforcement and demotion aligned.
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

// Live rows: not soft-deleted and inside validity window (null bounds = perpetual).
const activeNow = and(
  eq(entitlements.deleted, false),
  or(isNull(entitlements.startsAt), lte(entitlements.startsAt, sql`now()`)),
  or(isNull(entitlements.endsAt), gt(entitlements.endsAt, sql`now()`)),
)

// Guild tier from the mirror; for non-interaction contexts (depends on sync listeners).
export async function tierForGuild(guildId: bigint): Promise<PremiumTier> {
  return grantedFromMirror(and(eq(entitlements.guildId, guildId), activeNow))
}

// User tier from the mirror; guild subscriptions don't count here.
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
