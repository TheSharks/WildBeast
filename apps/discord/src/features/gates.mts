import type { EvaluationContext } from '@openfeature/server-sdk'
import type { BaseInteraction } from 'discord.js'
import {
  type PremiumSubject,
  subjectFromInteraction,
  tierForSubject,
} from '../premium/interaction.mjs'
import { tierAtLeast } from '../premium/limits.mjs'
import type { Scope, Tier } from '../premium/model.mjs'
import type { PremiumService } from '../premium/service.mjs'
import type { FeatureFlags } from './flags.mjs'
import { type CommandGateFlagKey, commandGateKey } from './registry.mjs'

export interface PremiumRequirement {
  tier?: Tier
  scope?: Scope | 'any'
}

/** One evaluation for every surface: chat, autocomplete, components and tasks. */
export interface GateEvaluation {
  subject: PremiumSubject
  command: string
  subcommand?: string
  scope: Scope | 'any'
  requiredTier: Tier
  /** Best of user/guild tiers; targeting and display only, never limits. */
  tierAny: Tier
  /** Scope-resolved tier; the only tier enforcement may use. */
  tierEnforced: Tier
  flagKey?: CommandGateFlagKey
  flagEnabled: boolean
  premiumAllowed: boolean
}

export type DenialReason = 'feature' | 'premium'

export function denialReason(
  evaluation: Pick<GateEvaluation, 'flagEnabled' | 'premiumAllowed'>,
): DenialReason | undefined {
  if (!evaluation.flagEnabled) return 'feature'
  if (!evaluation.premiumAllowed) return 'premium'
  return undefined
}

export function isAllowed(evaluation: GateEvaluation): boolean {
  return evaluation.flagEnabled && evaluation.premiumAllowed
}

export function resolveRequirement(requirement: PremiumRequirement = {}): {
  requiredTier: Tier
  requiredScope: Scope | 'any'
} {
  return {
    requiredTier: requirement.tier ?? 'premium',
    requiredScope: requirement.scope ?? 'any',
  }
}

export function subcommandOf(interaction: BaseInteraction): string | undefined {
  if (interaction.isChatInputCommand() || interaction.isAutocomplete()) {
    return interaction.options.getSubcommand(false) ?? undefined
  }
  return undefined
}

/** Command gates shared by preconditions, autocomplete, components and replies. */
export class CommandGates {
  private readonly requirements = new Map<string, PremiumRequirement>()

  public constructor(
    private readonly flags: FeatureFlags,
    private readonly premium: PremiumService,
  ) {}

  /** Preconditions cover neither autocomplete nor components; the gate does. */
  public requirePremium(
    command: string,
    requirement: PremiumRequirement = {},
  ): void {
    this.requirements.set(command, { ...requirement })
  }

  public requirementFor(command: string): PremiumRequirement | undefined {
    const requirement = this.requirements.get(command)
    return requirement ? { ...requirement } : undefined
  }

  public flagContext(
    subject: PremiumSubject,
    options: {
      command?: string
      subcommand?: string
      tier?: Tier
      targetingKey?: string
    } = {},
  ): EvaluationContext {
    return {
      targetingKey:
        options.targetingKey ?? (subject.guildId ?? subject.userId).toString(),
      userId: subject.userId.toString(),
      ...(subject.guildId !== null
        ? { guildId: subject.guildId.toString() }
        : {}),
      tier: options.tier ?? tierForSubject(this.premium, subject, 'any'),
      ...(options.command ? { command: options.command } : {}),
      ...(options.subcommand ? { subcommand: options.subcommand } : {}),
      ...(subject.shardId !== undefined
        ? { shardId: String(subject.shardId) }
        : {}),
    }
  }

  public async evaluate(
    subject: PremiumSubject,
    command: string,
    subcommand?: string,
  ): Promise<GateEvaluation> {
    const registered = this.requirements.get(command)
    const requiredTier = registered?.tier ?? (registered ? 'premium' : 'free')
    const scope = registered?.scope ?? 'any'
    const tierAny = tierForSubject(this.premium, subject, 'any')
    const tierEnforced = tierForSubject(this.premium, subject, scope)
    const flagKey = commandGateKey(command)
    const flagEnabled = flagKey
      ? await this.flags.enabled(
          flagKey,
          this.flagContext(subject, { command, subcommand, tier: tierAny }),
        )
      : true
    return {
      subject,
      command,
      ...(subcommand ? { subcommand } : {}),
      scope,
      requiredTier,
      tierAny,
      tierEnforced,
      ...(flagKey ? { flagKey } : {}),
      flagEnabled,
      premiumAllowed: registered
        ? tierAtLeast(tierEnforced, requiredTier)
        : true,
    }
  }

  public evaluateInteraction(interaction: BaseInteraction, command: string) {
    return this.evaluate(
      subjectFromInteraction(interaction),
      command,
      subcommandOf(interaction),
    )
  }

  /** Synchronous premium slice for surfaces that cannot await. */
  public premiumAllowed(subject: PremiumSubject, command: string): boolean {
    const requirement = this.requirements.get(command)
    if (!requirement) return true
    const { requiredTier, requiredScope } = resolveRequirement(requirement)
    return tierAtLeast(
      tierForSubject(this.premium, subject, requiredScope),
      requiredTier,
    )
  }
}
