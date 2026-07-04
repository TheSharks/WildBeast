import { ApplyOptions } from '@sapphire/decorators'
import type { Command } from '@sapphire/framework'
import { applyLocalizedBuilder } from '@sapphire/plugin-i18next'
import { TracedCommand } from '../../structures/command.mjs'
import { buildDogMessage } from '../../utils/funMessages.mjs'

@ApplyOptions<Command.Options>({
  cooldownDelay: 3_000,
})
export class DogCommand extends TracedCommand {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) => {
      applyLocalizedBuilder(
        builder,
        'commands/names:dog',
        'commands/descriptions:dog',
      )
    })
  }

  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    await interaction.deferReply()
    return interaction.editReply(await buildDogMessage(interaction))
  }
}
