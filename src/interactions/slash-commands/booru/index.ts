import { BaseSlashCommand } from '../../base'
import { BooruE621Command } from './booru.e621'

export default class BooruBaseCommand extends BaseSlashCommand {
  description = '.' // not shown
  name = 'booru'

  constructor () {
    super({
      options: [
        new BooruE621Command()
      ]
    })
  }
}
