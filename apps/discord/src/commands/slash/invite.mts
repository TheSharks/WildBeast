import type { Command } from '@sapphire/framework'
import { applyLocalizedBuilder, resolveKey } from '@sapphire/plugin-i18next'
import { MessageFlags, OAuth2Scopes } from 'discord.js'
import { TracedCommand } from '../../structures/command.mjs'

export class InviteCommand extends TracedCommand {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) => {
        applyLocalizedBuilder(
          builder,
          'commands/names:invite',
          'commands/descriptions:invite',
        )
      },
      {
        guildIds: ['1034462346908794910'],
      },
    )
  }

  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const { client } = this.container

    const override = process.env.WILDBEAST_INVITE_OVERRIDE
    if (override) {
      return this.replyEphemeral(interaction, 'done', { invite: override })
    }

    const application = await client.application?.fetch()
    if (application && !application.botPublic) {
      const owner = application.owner
      const ownerName =
        owner && 'members' in owner
          ? (owner.owner?.user.username ?? owner.name)
          : (owner?.username ?? '?')
      return this.replyEphemeral(interaction, 'private', { owner: ownerName })
    }

    return this.replyEphemeral(interaction, 'done', {
      invite: client.generateInvite({
        scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
      }),
    })
  }

  private async replyEphemeral(
    interaction: Command.ChatInputCommandInteraction,
    key: string,
    args: Record<string, string>,
  ) {
    return interaction.reply({
      content: (await resolveKey(
        interaction,
        `commands/invite:${key}`,
        args,
      )) as string,
      flags: MessageFlags.Ephemeral,
    })
  }
}
