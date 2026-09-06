import { isMessageInstance } from '@sapphire/discord.js-utilities'
import type { Command } from '@sapphire/framework'
import { applyLocalizedBuilder, resolveKey } from '@sapphire/plugin-i18next'
import { MessageFlags } from 'discord.js'
import { AppCommand } from '../structures/command.mjs'

export class PingCommand extends AppCommand {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) => {
      applyLocalizedBuilder(
        builder,
        'commands/names:ping',
        'commands/descriptions:ping',
      )
    })
  }

  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const message = await interaction.reply({
      content: (await resolveKey(
        interaction,
        'commands/ping:success',
      )) as string,
      flags: MessageFlags.Ephemeral,
      fetchReply: true,
    })
    if (isMessageInstance(message)) {
      return interaction.editReply(
        await resolveKey(interaction, 'commands/ping:success_with_args', {
          diff: message.createdTimestamp - interaction.createdTimestamp,
          ping: Math.round(this.container.client.ws.ping),
        }),
      )
    }
    return interaction.editReply(
      await resolveKey(interaction, 'commands/ping:failed'),
    )
  }
}
