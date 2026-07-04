import { ApplyOptions } from '@sapphire/decorators'
import type { Command } from '@sapphire/framework'
import { applyLocalizedBuilder } from '@sapphire/plugin-i18next'
import { TracedCommand } from '../../structures/command.mjs'
import { buildInspireMessage } from '../../utils/funMessages.mjs'

@ApplyOptions<Command.Options>({
  cooldownDelay: 3_000,
})
export class InspireCommand extends TracedCommand {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) => {
        applyLocalizedBuilder(
          builder,
          'commands/names:inspire',
          'commands/descriptions:inspire',
        )
      },
      {
        guildIds: ['1034462346908794910'],
      },
    )
  }

  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    await interaction.deferReply()
    return interaction.editReply(await buildInspireMessage(interaction))
  }
}
