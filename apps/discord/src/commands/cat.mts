import { ApplyOptions } from '@sapphire/decorators'
import type { Command } from '@sapphire/framework'
import { applyLocalizedBuilder } from '@sapphire/plugin-i18next'
import { buildCatMessage } from '../integrations/fun-messages.mjs'
import { AppCommand } from '../structures/command.mjs'

@ApplyOptions<Command.Options>({ cooldownDelay: 3_000 })
export class CatCommand extends AppCommand {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) => {
      applyLocalizedBuilder(
        builder,
        'commands/names:cat',
        'commands/descriptions:cat',
      )
    })
  }

  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    await interaction.deferReply()
    return interaction.editReply(await buildCatMessage(interaction))
  }
}
