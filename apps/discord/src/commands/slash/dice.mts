import type { Command } from '@sapphire/framework'
import { applyLocalizedBuilder, resolveKey } from '@sapphire/plugin-i18next'
import { TracedCommand } from '../../structures/command.mjs'

export class DiceCommand extends TracedCommand {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) => {
        applyLocalizedBuilder(
          builder,
          'commands/names:dice',
          'commands/descriptions:dice',
        )
          .addIntegerOption((option) =>
            applyLocalizedBuilder(
              option,
              'commands/names:diceOptionDice',
              'commands/descriptions:diceOptionDice',
            )
              .setMinValue(1)
              .setMaxValue(100),
          )
          .addIntegerOption((option) =>
            applyLocalizedBuilder(
              option,
              'commands/names:diceOptionSides',
              'commands/descriptions:diceOptionSides',
            )
              .setMinValue(2)
              .setMaxValue(1_000),
          )
      },
      {
        guildIds: ['1034462346908794910'],
      },
    )
  }

  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const dice = interaction.options.getInteger('dice') ?? 1
    const sides = interaction.options.getInteger('sides') ?? 6

    let total = 0
    for (let i = 0; i < dice; i++) {
      total += Math.floor(Math.random() * sides) + 1
    }

    return interaction.reply(
      (await resolveKey(interaction, 'commands/dice:result', {
        dice,
        sides,
        total,
      })) as string,
    )
  }
}
