import type { Command } from '@sapphire/framework'
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
