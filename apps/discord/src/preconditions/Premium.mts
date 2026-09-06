import { Precondition } from '@sapphire/framework'
import type {
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
} from 'discord.js'
import {
  type PremiumRequirement,
  resolveRequirement,
} from '../features/gates.mjs'
import {
  subjectFromInteraction,
  tierForSubject,
} from '../premium/interaction.mjs'
import { tierAtLeast } from '../premium/limits.mjs'

export const PremiumPreconditionIdentifier = 'preconditionPremium'

export interface PremiumPreconditionContext
  extends Precondition.Context,
    PremiumRequirement {}

/** Interaction grants are authoritative; the mirror is never consulted here. */
export class PremiumPrecondition extends Precondition {
  public override chatInputRun(
    interaction: ChatInputCommandInteraction,
    _command: unknown,
    context: PremiumPreconditionContext,
  ) {
    return this.check(interaction, context)
  }

  public override contextMenuRun(
    interaction: ContextMenuCommandInteraction,
    _command: unknown,
    context: PremiumPreconditionContext,
  ) {
    return this.check(interaction, context)
  }

  private check(
    interaction: ChatInputCommandInteraction | ContextMenuCommandInteraction,
    context: PremiumPreconditionContext,
  ) {
    const { requiredTier, requiredScope } = resolveRequirement(context)
    const currentTier = tierForSubject(
      this.container.app.premium,
      subjectFromInteraction(interaction),
      requiredScope,
    )
    if (tierAtLeast(currentTier, requiredTier)) return this.ok()
    return this.error({
      identifier: PremiumPreconditionIdentifier,
      message: 'This command requires a premium subscription.',
      context: { ...context, requiredTier, requiredScope, currentTier },
    })
  }
}

declare module '@sapphire/framework' {
  interface Preconditions {
    Premium: PremiumPreconditionContext
  }
}
