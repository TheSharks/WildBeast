import {
  type ChatInputCommand,
  type ContextMenuCommand,
  Precondition,
} from '@sapphire/framework'
import type {
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
} from 'discord.js'
import {
  evaluateGates,
  subjectFromInteraction,
} from '../features/evaluation.mjs'
import type { GateFlagKey } from '../features/registry.mjs'

export const FeaturePreconditionIdentifier = 'preconditionFeature'

export interface FeaturePreconditionContext extends Precondition.Context {
  key: GateFlagKey
}

/** OFREP-backed command gate. TracedCommand/TracedSubcommand attach the
 * command's registered gate automatically; commands stay registered in
 * Discord and receive a localized denial when their flag resolves false. */
export class FeaturePrecondition extends Precondition {
  public override chatInputRun(
    interaction: ChatInputCommandInteraction,
    command: ChatInputCommand,
    context: FeaturePreconditionContext,
  ) {
    return this.check(interaction, command.name, context)
  }

  public override contextMenuRun(
    interaction: ContextMenuCommandInteraction,
    command: ContextMenuCommand,
    context: FeaturePreconditionContext,
  ) {
    return this.check(interaction, command.name, context)
  }

  private async check(
    interaction: ChatInputCommandInteraction | ContextMenuCommandInteraction,
    command: string,
    context: FeaturePreconditionContext,
  ) {
    // Single gate boundary; this precondition enforces the flag slice only.
    const evaluation = await evaluateGates(
      subjectFromInteraction(interaction),
      command,
      subcommandOf(interaction),
    )
    if (evaluation.flagEnabled) return this.ok()
    return this.error({
      identifier: FeaturePreconditionIdentifier,
      message: 'This command is temporarily unavailable.',
      context: { ...context, command },
    })
  }
}

// Chat-input subcommand for flag targeting; context menus carry none.
function subcommandOf(
  interaction: ChatInputCommandInteraction | ContextMenuCommandInteraction,
): string | undefined {
  if (interaction.isChatInputCommand()) {
    return interaction.options.getSubcommand(false) ?? undefined
  }
  return undefined
}

declare module '@sapphire/framework' {
  interface Preconditions {
    Feature: FeaturePreconditionContext
  }
}
