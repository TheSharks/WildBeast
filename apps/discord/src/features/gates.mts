import type { Command } from '@sapphire/framework'
import type { BaseInteraction } from 'discord.js'
import { booleanFlagValue } from './client.mjs'
import { commandFlagContext } from './commandContext.mjs'
import { commandGateKey } from './registry.mjs'

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
 * preconditions cannot protect later button clicks. */
export async function commandComponentEnabled(
  interaction: BaseInteraction,
  command: string,
): Promise<boolean> {
  const key = commandGateKey(command)
  return key
    ? booleanFlagValue(key, commandFlagContext(interaction, command))
    : true
}
