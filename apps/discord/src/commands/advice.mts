import { ApplyOptions } from '@sapphire/decorators'
import type { Command } from '@sapphire/framework'
import { applyLocalizedBuilder } from '@sapphire/plugin-i18next'
import { fetchJson } from '../integrations/http.mjs'
import { AppCommand } from '../structures/command.mjs'

@ApplyOptions<Command.Options>({ cooldownDelay: 3_000 })
export class AdviceCommand extends AppCommand {
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
    // adviceslip caches a slip for about 2s; the query string busts that.
    const { slip } = await fetchJson<{ slip: { advice: string } }>(
      `https://api.adviceslip.com/advice?t=${interaction.id}`,
    )
    return interaction.reply(slip.advice)
  }
}
