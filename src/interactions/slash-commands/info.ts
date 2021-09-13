import { Interaction } from 'detritus-client'
import { Embed } from 'detritus-client/lib/utils'
import { t } from '../../utils/i18n'

import { BaseSlashCommand } from '../base'

import { sub } from 'date-fns'
import { MessageFlags } from 'detritus-client/lib/constants'
// no import - messes with tsc (package.json is outside the source dir)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../../package.json')

export default class InfoCommand extends BaseSlashCommand {
  description = 'Get information about the bot'
  name = 'info'

  constructor () {
    super({
      guildIds: ['110462143152803840']
    })
  }

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
      .addField(t('commands.info.guilds'), `${context.client.guilds.size}`, true)
      .addField(t('commands.info.uptime'), `<t:${Math.floor(uptime.getTime() / 1000)}:R>`, true)
      .addField(t('commands.info.shard'), `${context.client.shardId}/${context.client.shardCount}`, true)
      .addField(t('commands.info.owner'), `${owner.username}#${owner.discriminator}`, true)
      .addField(t('commands.info.version'), `v${version as string}`, true)
      .addField(t('commands.info.node'), `${process.version}`, true)
      .addField(t('commands.info.os'), `${process.platform}`, true)
      .addField(t('commands.info.ram'), `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, true)
      .addField(t('commands.info.cpu'), `${Math.round(process.cpuUsage().user / 1000 / 1000)}%`, true)
      .setColor(0x00AE86)
      .setThumbnail(context.client.user!.avatarUrl)
      .setFooter(`${context.client.user!.username} - ${t('commands.info.poweredBy')}`)
    await this.safeReply(context, {
      embed,
      flags: MessageFlags.EPHEMERAL
    })
  }
}
