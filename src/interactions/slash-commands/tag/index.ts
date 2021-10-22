import { BaseSlashCommand } from '../../base'
import { CreateTagCommand } from './tag.create'
import { DeleteTagCommand } from './tag.delete'
import { EditTagCommand } from './tag.edit'
import { ShowTagCommand } from './tag.show'

export default class TagBaseCommand extends BaseSlashCommand {
  description = '.' // not shown
  name = 'tag'

  constructor () {
    super({
      options: [
        new CreateTagCommand(),
        new EditTagCommand(),
        new ShowTagCommand(),
        new DeleteTagCommand()
      ]
    })
  }
}
