import {
  type ChatInputCommand,
  type ContextMenuCommand,
  Precondition,
} from '@sapphire/framework'
import type {
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
} from 'discord.js'
import type { GateFlagKey } from '../features/registry.mjs'

export const FeaturePreconditionIdentifier = 'preconditionFeature'

export interface FeaturePreconditionContext extends Precondition.Context {
  key: GateFlagKey
}

/** Commands stay registered in Discord and receive a localized denial when off. */
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
    const evaluation = await this.container.app.gates.evaluateInteraction(
      interaction,
      command,
    )
    if (evaluation.flagEnabled) return this.ok()
    return this.error({
      identifier: FeaturePreconditionIdentifier,
      message: 'This command is temporarily unavailable.',
      context: { ...context, command },
    })
  }
}

declare module '@sapphire/framework' {
  interface Preconditions {
    Feature: FeaturePreconditionContext
  }
}
