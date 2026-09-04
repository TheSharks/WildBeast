import type { Command } from '@sapphire/framework'
import type { AutocompleteInteraction, BaseInteraction } from 'discord.js'
import {
  isPremiumSatisfied,
  type PremiumPreconditionContext,
} from '../preconditions/Premium.mjs'
import { booleanFlagValue } from './client.mjs'
import { commandFlagContext } from './commandContext.mjs'
import { commandGateKey } from './registry.mjs'

// Premium requirements for surfaces preconditions miss (autocomplete, later clicks).
const premiumGates = new Map<string, PremiumPreconditionContext>()

// Registered premium requirement, if any.
export function premiumGateFor(
  command: string,
): PremiumPreconditionContext | undefined {
  return premiumGates.get(command)
}

// Gate check; true when the command has no requirement.
export function commandPremiumAllowed(
  interaction: BaseInteraction,
  command: string,
): boolean {
  const requirement = premiumGates.get(command)
  if (!requirement) return true
  return isPremiumSatisfied(interaction, requirement)
}

// Gate command invocations and suppress autocomplete work while disabled.
export function installCommandFeatureGate(command: Command): void {
  const key = commandGateKey(command.name)
  if (!key) return

  command.preconditions.append({ name: 'Feature', context: { key } })

  const autocompleteRun = command.autocompleteRun?.bind(command)
  if (!autocompleteRun) return
  command.autocompleteRun = async (interaction) => {
    const enabled = await booleanFlagValue(
      key,
      commandFlagContext(interaction, command.name),
    )
    return enabled ? autocompleteRun(interaction) : interaction.respond([])
  }
}

// Kill switch for components, which outlive invocations; also re-checks the premium gate.
export async function commandComponentEnabled(
  interaction: BaseInteraction,
  command: string,
): Promise<boolean> {
  if (!commandPremiumAllowed(interaction, command)) return false
  const key = commandGateKey(command)
  return key
    ? booleanFlagValue(key, commandFlagContext(interaction, command))
    : true
}

// Premium-gate a command with autocomplete + component coverage (preconditions cover neither).
export function installCommandPremiumGate(
  command: Command,
  context: PremiumPreconditionContext = {},
): void {
  premiumGates.set(command.name, context)
  command.preconditions.append({ name: 'Premium', context })

  const autocompleteRun = command.autocompleteRun?.bind(command)
  if (!autocompleteRun) return
  command.autocompleteRun = async (interaction: AutocompleteInteraction) => {
    if (!isPremiumSatisfied(interaction, context)) {
      return interaction.respond([])
    }
    return autocompleteRun(interaction)
  }
}

// Premium-only component re-check; prefer commandComponentEnabled when both gates apply.
export function premiumComponentAllowed(
  interaction: BaseInteraction,
  command: string,
): boolean {
  return commandPremiumAllowed(interaction, command)
}
