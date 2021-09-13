import { Interaction } from 'detritus-client'
import { MessageFlags } from 'detritus-client/lib/constants'
import { t } from '../../utils/i18n'

import { BaseSlashCommand } from '../base'

export default class InviteCommand extends BaseSlashCommand {
  description = 'Get an invite link for the bot'
  name = 'invite'

  async run (context: Interaction.InteractionContext): Promise<void> {
    if (process.env.WILDBEAST_INVITE_OVERRIDE !== undefined) {
      await this.safeReply(context, {
        content: t('commands.invite.done', {
          invite: process.env.WILDBEAST_INVITE_OVERRIDE
        }),
        flags: MessageFlags.EPHEMERAL
      })
      return
    }
    if (!context.client.application!.botPublic) {
      if (context.client.application!.team !== undefined) {
        const teamowner = context.client.application!.team.owner!
        await this.safeReply(context, {
          content: t('commands.invite.private', {
            owner: `${teamowner.username}#${teamowner.discriminator}`
          }),
          flags: MessageFlags.EPHEMERAL
        })
      } else {
        const owner = context.client.application!.owner
        await this.safeReply(context, {
          content: t('commands.invite.private', {
            owner: `${owner.username}#${owner.discriminator}`
          }),
          flags: MessageFlags.EPHEMERAL
        })
      }
    } else {
      await this.safeReply(context, {
        content: t('commands.invite.done', {
          invite: `https://discordapp.com/oauth2/authorize?&client_id=${context.client.application!.id}&scope=bot%20applications.commands`
        }),
        flags: MessageFlags.EPHEMERAL
      })
    }
  }
}
