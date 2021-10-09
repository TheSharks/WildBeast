import { BaseSlashCommand } from '../../base'
import { BooruE621Command } from './booru.e621'

export default class BooruBaseCommand extends BaseSlashCommand {
  description = '.' // not shown
  name = 'booru'

  constructor () {
    super({
      guildIds: ['110462143152803840', '577263837879730195'],
      options: [
        new BooruE621Command()
      ]
    })
  }
}
