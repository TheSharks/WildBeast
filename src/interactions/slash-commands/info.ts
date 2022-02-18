import { Interaction } from 'detritus-client'
import { Embed } from 'detritus-client/lib/utils'

import { BaseSlashCommand } from '../base'

import { sub } from 'date-fns'
import { MessageFlags } from 'detritus-client/lib/constants'
// no import - messes with tsc (package.json is outside the source dir)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../../package.json')

export default class InfoCommand extends BaseSlashCommand {
  name = 'info'
  description = this.translateThis('metadata.description')

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
      .addField(this.translateThis('guilds'), `${context.client.guilds.size}`, true)
      .addField(this.translateThis('uptime'), `<t:${Math.floor(uptime.getTime() / 1000)}:R>`, true)
      .addField(this.translateThis('shard'), `${context.client.shardId}/${context.client.shardCount}`, true)
      .addField(this.translateThis('owner'), `${owner.username}#${owner.discriminator}`, true)
      .addField(this.translateThis('version'), `v${version as string}`, true)
      .addField(this.translateThis('node'), `${process.version}`, true)
      .addField(this.translateThis('os'), `${process.platform}`, true)
      .addField(this.translateThis('ram'), `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, true)
      .addField(this.translateThis('cpu'), `${Math.round(process.cpuUsage().user / 1000 / 1000)}%`, true)
      .setColor(0x00AE86)
      .setThumbnail(context.client.user!.avatarUrl)
      .setFooter(`${context.client.user!.username} - ${this.translateThis('poweredBy')}`)
    await context.editOrRespond({
      embed,
      flags: MessageFlags.EPHEMERAL
    })
  }
}
