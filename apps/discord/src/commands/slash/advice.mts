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
    registry.registerChatInputCommand((builder) => {
      applyLocalizedBuilder(
        builder,
        'commands/names:advice',
        'commands/descriptions:advice',
      )
    })
  }

  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    // adviceslip serves a cached slip for ~2 seconds; the query string
    // busts that so back-to-back calls differ.
    const { slip } = await fetchJson<{ slip: { advice: string } }>(
      `https://api.adviceslip.com/advice?t=${interaction.id}`,
    )
    return interaction.reply(slip.advice)
  }
}
