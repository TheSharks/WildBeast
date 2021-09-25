import { BaseSlashCommand } from '../../base'
import { CreateTagCommand } from './tag.create'
import { EditTagCommand } from './tag.edit'

export default class TagBaseCommand extends BaseSlashCommand {
  description = '.' // not shown
  name = 'tag'

  constructor () {
    super({
      guildIds: ['110462143152803840'],
      options: [
        new CreateTagCommand(),
        new EditTagCommand()
      ]
    })
  }
}
