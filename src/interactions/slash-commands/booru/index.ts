import { BaseSlashCommand } from '../../base'
import { BooruDerpibooruCommand } from './booru.derpibooru'
import { BooruE621Command } from './booru.e621'
// import { BooruGelbooruCommand } from './booru.gelbooru'
import { BooruRule34Command } from './booru.rule34'

export default class BooruBaseCommand extends BaseSlashCommand {
  description = 'Query various image boards for images'
  name = 'booru'

  constructor () {
    super({
      options: [
        new BooruE621Command(),
        new BooruRule34Command(),
        // new BooruGelbooruCommand(),
        new BooruDerpibooruCommand()
      ]
    })
  }
}
