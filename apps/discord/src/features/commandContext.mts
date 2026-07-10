import type { EvaluationContext } from '@openfeature/server-sdk'
import type { BaseInteraction } from 'discord.js'
import { tierForInteraction } from '../premium/entitlements.mjs'
import { interactionFlagContext } from './context.mjs'

/**
 * The evaluation context for command-surface flags: gates, autocomplete
 * suppression, and experiments. Every command call site must build its
 * context here so targeting attributes stay uniform — a hand-rolled
 * context that forgets `tier` or `subcommand` doesn't fail, it just
 * silently stops matching the service's rules.
 *
 * Lives apart from context.mts because tier resolution comes from
 * premium/entitlements.mjs, which itself imports context.mjs.
 */
export function commandFlagContext(
  interaction: BaseInteraction,
  command: string,
): EvaluationContext {
  return interactionFlagContext(interaction, {
    command,
    subcommand: subcommandOf(interaction),
    tier: tierForInteraction(interaction),
  })
}

function subcommandOf(interaction: BaseInteraction): string | undefined {
  if (interaction.isChatInputCommand() || interaction.isAutocomplete()) {
    return interaction.options.getSubcommand(false) ?? undefined
  }
  return undefined
}
