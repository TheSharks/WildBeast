import type { Command } from '@sapphire/framework'
import { applyLocalizedBuilder, resolveKey } from '@sapphire/plugin-i18next'
import { TracedCommand } from '../../structures/command.mjs'

export class EightBallCommand extends TracedCommand {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) => {
      applyLocalizedBuilder(
        builder,
        'commands/names:8ball',
        'commands/descriptions:8ball',
      )
    })
  }

  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const choices = (await resolveKey(interaction, 'commands/8ball:choices', {
      returnObjects: true,
    })) as unknown as string[]
    if (!Array.isArray(choices) || choices.length === 0) {
      throw new Error('8ball choices are not configured')
    }
    const response = choices[Math.floor(Math.random() * choices.length)]

    return interaction.reply(
      (await resolveKey(interaction, 'commands/8ball:prefix', {
        response,
      })) as string,
    )
  }
}
