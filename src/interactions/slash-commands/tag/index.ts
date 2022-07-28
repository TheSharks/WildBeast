import { BaseSlashCommand } from '../../base'
import { CreateTagCommand } from './tag.create'
import { DeleteTagCommand } from './tag.delete'
import { EditTagCommand } from './tag.edit'
import { TagInfoCommand } from './tag.info'
import { ShowTagCommand } from './tag.show'

export default class TagBaseCommand extends BaseSlashCommand {
  description = 'Create and manage tags'
  name = 'tag'

  constructor () {
    super({
      options: [
        new CreateTagCommand(),
        new EditTagCommand(),
        new ShowTagCommand(),
        new DeleteTagCommand(),
        new TagInfoCommand()
      ]
    })
  }
}
