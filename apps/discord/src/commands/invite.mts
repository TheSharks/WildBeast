import type { Command } from '@sapphire/framework'
import { applyLocalizedBuilder, resolveKey } from '@sapphire/plugin-i18next'
import { MessageFlags, OAuth2Scopes } from 'discord.js'
import { AppCommand } from '../structures/command.mjs'

export class InviteCommand extends AppCommand {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) => {
      applyLocalizedBuilder(
        builder,
        'commands/names:invite',
        'commands/descriptions:invite',
      )
    })
  }

  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const { client } = this.container
    const override = this.container.app.config.inviteOverride
    if (override) return this.reply(interaction, 'done', { invite: override })
    const application = await client.application?.fetch()
    if (application && !application.botPublic) {
      const owner = application.owner
      const ownerName =
        owner && 'members' in owner
          ? (owner.owner?.user.username ?? owner.name)
          : (owner?.username ?? '?')
      return this.reply(interaction, 'private', { owner: ownerName })
    }
    return this.reply(interaction, 'done', {
      invite: client.generateInvite({
        scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
      }),
    })
  }

  private async reply(
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
