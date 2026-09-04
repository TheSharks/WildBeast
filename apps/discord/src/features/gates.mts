import type { Command } from '@sapphire/framework'
import type { AutocompleteInteraction, BaseInteraction } from 'discord.js'
import {
  isPremiumSatisfied,
  type PremiumPreconditionContext,
} from '../preconditions/Premium.mjs'
import { booleanFlagValue } from './client.mjs'
import { commandFlagContext } from './commandContext.mjs'
import { commandGateKey } from './registry.mjs'

/**
 * Premium requirements registered per command for surfaces Sapphire
 * preconditions never reach (autocomplete, later component clicks).
 * Commands gating via the Premium precondition should register here with
 * installCommandPremiumGate so those surfaces stay behind the same tier.
 */
const premiumGates = new Map<string, PremiumPreconditionContext>()

/** The registered premium requirement for `command`, if any. */
export function premiumGateFor(
  command: string,
): PremiumPreconditionContext | undefined {
  return premiumGates.get(command)
}

/** Whether `interaction` satisfies the registered premium gate for
 * `command`; true when the command has no premium requirement. */
export function commandPremiumAllowed(
  interaction: BaseInteraction,
  command: string,
): boolean {
  const requirement = premiumGates.get(command)
  if (!requirement) return true
  return isPremiumSatisfied(interaction, requirement)
}

/** Attach the typed gate for a command and suppress autocomplete work while
 * disabled. Sapphire does not run command preconditions for autocomplete,
 * so the wrapper is necessary to stop disabled commands hitting databases
 * and external APIs as users type. */
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

/** Apply the same command kill switch to stateless component handlers.
 * Components outlive the command invocation that created them, so command
 * preconditions cannot protect later button clicks. Also re-checks the
 * registered premium gate: a lapsed subscription must not keep working
 * through a stale button. */
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

/**
 * Gate a command behind a premium tier with the same autocomplete +
 * component coverage as installCommandFeatureGate. Appends the Premium
 * precondition for invocations and suppresses autocomplete work plus
 * component clicks while the gate denies — Sapphire runs preconditions
 * for neither surface.
 */
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

/** Re-check helper for stateful component handlers owned by a gated
 * command. Prefer commandComponentEnabled (feature + premium together);
 * use this when only the premium gate applies. */
export function premiumComponentAllowed(
  interaction: BaseInteraction,
  command: string,
): boolean {
  return commandPremiumAllowed(interaction, command)
}
