import { Interaction } from 'detritus-client'
import { Embed } from 'detritus-client/lib/utils'
import { translate } from '../../utils/i18n'

import { BaseSlashCommand } from '../base'

import { sub } from 'date-fns'
import { MessageFlags } from 'detritus-client/lib/constants'
// no import - messes with tsc (package.json is outside the source dir)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../../package.json')

export default class InfoCommand extends BaseSlashCommand {
  description = 'Get information about the bot'
  name = 'info'

  async run (context: Interaction.InteractionContext): Promise<void> {
    let owner
    if (context.client.application!.team !== undefined) {
      owner = context.client.application!.team.owner!
    } else {
      owner = context.client.application!.owner
    }
    const uptime = sub(new Date(), { seconds: process.uptime() })
    const embed = new Embed()
      .setTitle('Info')
      .addField(translate('commands.info.guilds'), `${context.client.guilds.size}`, true)
      .addField(translate('commands.info.uptime'), `<t:${Math.floor(uptime.getTime() / 1000)}:R>`, true)
      .addField(translate('commands.info.shard'), `${context.client.shardId}/${context.client.shardCount}`, true)
      .addField(translate('commands.info.owner'), `${owner.username}#${owner.discriminator}`, true)
      .addField(translate('commands.info.version'), `v${version as string}`, true)
      .addField(translate('commands.info.node'), `${process.version}`, true)
      .addField(translate('commands.info.os'), `${process.platform}`, true)
      .addField(translate('commands.info.ram'), `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, true)
      .addField(translate('commands.info.cpu'), `${Math.round(process.cpuUsage().user / 1000 / 1000)}%`, true)
      .setColor(0x00AE86)
      .setThumbnail(context.client.user!.avatarUrl)
      .setFooter(`${context.client.user!.username} - ${translate('commands.info.poweredBy')}`)
    await this.safeReply(context, {
      embed,
      flags: MessageFlags.EPHEMERAL
    })
  }
}
