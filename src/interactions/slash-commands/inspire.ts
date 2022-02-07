import { Interaction } from 'detritus-client'
import { MessageFlags } from 'detritus-client/lib/constants'
import fetch from 'node-fetch'
import { translate } from '../../utils/i18n'
import { error } from '../../utils/logger'

import { BaseSlashCommand } from '../base'

export default class InspirobotCommand extends BaseSlashCommand {
  name = 'inspire'
  description = 'Get a random quote from inspirobot.com'

  async run (context: Interaction.InteractionContext): Promise<void> {
    const url = await (await fetch('https://inspirobot.me/api?generate=true')).text()
    try {
      const ctx = new URL(url)
      await context.editOrRespond( {
        embed: {
          image: {
            url: ctx.href
          },
          footer: {
            text: 'Powered by inspirobot.me',
            iconUrl: 'https://inspirobot.me/website/images/inspirobot-dark-green.png'
          },
          color: 0x1a6607
        }
      })
    } catch (e) {
      error(e, this.constructor.name)
      await context.editOrRespond({
        content: translate('commands.common.softFail'),
        flags: MessageFlags.EPHEMERAL
      })
    }
  }
}
