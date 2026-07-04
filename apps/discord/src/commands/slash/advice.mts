import { ApplyOptions } from '@sapphire/decorators'
import type { Command } from '@sapphire/framework'
import { applyLocalizedBuilder } from '@sapphire/plugin-i18next'
import { TracedCommand } from '../../structures/command.mjs'
import { fetchJson } from '../../utils/http.mjs'

@ApplyOptions<Command.Options>({
  cooldownDelay: 3_000,
})
export class AdviceCommand extends TracedCommand {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) => {
        applyLocalizedBuilder(
          builder,
          'commands/names:advice',
          'commands/descriptions:advice',
        )
      },
      {
        guildIds: ['1034462346908794910'],
      },
    )
  }

  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const { slip } = await fetchJson<{ slip: { advice: string } }>(
      'https://api.adviceslip.com/advice',
    )
    return interaction.reply(slip.advice)
  }
}
