import type { EvaluationContext } from '@openfeature/server-sdk'
import type { BaseInteraction } from 'discord.js'
import { premiumSkuMap } from '../premium/skus.mjs'
import {
  FREE_TIER,
  highestTier,
  type PremiumScope,
  type PremiumTier,
  tierAtLeast,
} from '../premium/tiers.mjs'
import { booleanFlagValue } from './client.mjs'
import { type CommandGateFlagKey, commandGateKey } from './registry.mjs'

// Minimal snapshot of an interaction entitlement for sync tier resolution.
export interface GateEntitlement {
  skuId: string
  guildId: string | null
  active: boolean
}

// Black-box gate subject; interaction-derived via subjectFromInteraction.
export interface GateSubject {
  userId: string
  guildId?: string
  shardId?: string
  entitlements?: GateEntitlement[]
}

// Premium requirement shape; mirrors PremiumPreconditionContext without the import.
export interface GatePremiumRequirement {
  tier?: PremiumTier
  scope?: PremiumScope | 'any'
}

// One evaluation for every surface (chat/autocomplete/component/task callers share it).
export interface GateEvaluation {
  subject: GateSubject
  command: string
  subcommand?: string
  scope: PremiumScope | 'any'
  requiredTier: PremiumTier
  /** Best of user/guild tiers; for flag targeting/display only, never for limits. */
  tierAny: PremiumTier
  /** Scope-resolved tier; the only tier limits/enforcement may use. */
  tierEnforced: PremiumTier
  flagKey?: CommandGateFlagKey
  flagEnabled: boolean
  premiumAllowed: boolean
}

// Premium requirements for surfaces preconditions miss (autocomplete, later clicks).
const premiumRequirements = new Map<string, GatePremiumRequirement>()

// Registered premium requirement, if any.
export function premiumRequirementFor(
  command: string,
): GatePremiumRequirement | undefined {
  const requirement = premiumRequirements.get(command)
  return requirement ? { ...requirement } : undefined
}

// Register a command's premium requirement (installer path).
export function registerPremiumGate(
  command: string,
  context: GatePremiumRequirement = {},
): void {
  premiumRequirements.set(command, { ...context })
}

// Effective tier + scope for a requirement context.
export function resolvePremiumRequirement(
  context: GatePremiumRequirement = {},
): { requiredTier: PremiumTier; requiredScope: PremiumScope | 'any' } {
  return {
    requiredTier: context.tier ?? 'premium',
    requiredScope: context.scope ?? 'any',
  }
}

// Capture the sync tier inputs off an interaction (entitlements ride it).
export function subjectFromInteraction(
  interaction: BaseInteraction,
): GateSubject {
  const entitlements: GateEntitlement[] = []
  for (const entitlement of interaction.entitlements?.values() ?? []) {
    entitlements.push({
      skuId: String(entitlement.skuId),
      guildId: entitlement.guildId ?? null,
      active: entitlement.isActive(),
    })
  }
  return {
    userId: interaction.user.id,
    ...(interaction.guildId ? { guildId: interaction.guildId } : {}),
    ...(interaction.guild?.shardId !== undefined
      ? { shardId: String(interaction.guild.shardId) }
      : {}),
    entitlements,
  }
}

function tiersForSubject(
  subject: GateSubject,
  applies: (entitlement: GateEntitlement) => boolean,
): PremiumTier[] {
  const skus = premiumSkuMap()
  if (skus.size === 0) return []
  const tiers: PremiumTier[] = []
  for (const entitlement of subject.entitlements ?? []) {
    if (!entitlement.active || !applies(entitlement)) continue
    const sku = skus.get(entitlement.skuId)
    if (sku) tiers.push(sku.tier)
  }
  return tiers
}

// Invoker's own tier, anywhere.
export function userTierForSubject(subject: GateSubject): PremiumTier {
  return highestTier(
    tiersForSubject(subject, (entitlement) => entitlement.guildId === null),
  )
}

// Current guild's tier; free in DMs.
export function guildTierForSubject(subject: GateSubject): PremiumTier {
  if (!subject.guildId) return FREE_TIER
  return highestTier(
    tiersForSubject(
      subject,
      (entitlement) => entitlement.guildId === subject.guildId,
    ),
  )
}

// Best of either scope for gate targeting; never for limits.
export function tierAny(subject: GateSubject): PremiumTier {
  return highestTier([
    userTierForSubject(subject),
    guildTierForSubject(subject),
  ])
}

// Scope-resolved tier for enforcement; single place for scope handling.
export function tierEnforced(
  subject: GateSubject,
  scope: PremiumScope | 'any',
): PremiumTier {
  return {
    user: userTierForSubject,
    guild: guildTierForSubject,
    any: tierAny,
  }[scope](subject)
}

// Flag context from a subject; mirrors interactionFlagContext targeting.
export function gateFlagContext(
  subject: GateSubject,
  command: string,
  subcommand?: string,
): EvaluationContext {
  return {
    targetingKey: subject.guildId ?? subject.userId,
    userId: subject.userId,
    ...(subject.guildId ? { guildId: subject.guildId } : {}),
    tier: tierAny(subject),
    command,
    ...(subcommand ? { subcommand } : {}),
    ...(subject.shardId ? { shardId: subject.shardId } : {}),
    ...(process.env.WILDBEAST_CLUSTER_ID
      ? { clusterId: process.env.WILDBEAST_CLUSTER_ID }
      : {}),
    environment: process.env.NODE_ENV ?? 'development',
  }
}

// Resolve flag + premium once; callers read slices via isAllowed/denialReason.
export async function evaluateGates(
  subject: GateSubject,
  commandName: string,
  subcommand?: string,
): Promise<GateEvaluation> {
  const registered = premiumRequirements.get(commandName)
  const requiredTier = registered?.tier ?? (registered ? 'premium' : 'free')
  const scope = registered?.scope ?? 'any'
  const anyTier = tierAny(subject)
  const enforcedTier = tierEnforced(subject, scope)
  const flagKey = commandGateKey(commandName)
  const flagEnabled = flagKey
    ? await booleanFlagValue(
        flagKey,
        gateFlagContext(subject, commandName, subcommand),
      )
    : true
  return {
    subject,
    command: commandName,
    ...(subcommand ? { subcommand } : {}),
    scope,
    requiredTier,
    tierAny: anyTier,
    tierEnforced: enforcedTier,
    ...(flagKey ? { flagKey } : {}),
    flagEnabled,
    premiumAllowed: registered ? tierAtLeast(enforcedTier, requiredTier) : true,
  }
}

// Uniform allow check across chat/autocomplete/component/task paths.
export function isAllowed(evaluation: GateEvaluation): boolean {
  return evaluation.flagEnabled && evaluation.premiumAllowed
}

// Uniform denial reason; undefined means allowed.
export function denialReason(
  evaluation: Pick<GateEvaluation, 'flagEnabled' | 'premiumAllowed'>,
): 'feature' | 'premium' | undefined {
  if (!evaluation.flagEnabled) return 'feature'
  if (!evaluation.premiumAllowed) return 'premium'
  return undefined
}
