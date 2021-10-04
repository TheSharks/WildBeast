import { Interaction } from 'detritus-client'
import { ComponentActionRow, ComponentContext, Components, Embed } from 'detritus-client/lib/utils'
import fetch from 'node-fetch'

import { BaseSlashCommand } from '../base'

export interface CommandArgs {
  query: string
}

export default class UrbanDictionaryCommand extends BaseSlashCommand {
  description = 'Search Urban Dictionary'
  name = 'urbandictionary'

  constructor () {
    super({
      guildIds: ['110462143152803840'],
      options: [
        {
          name: 'query',
          description: 'What to search for',
          required: true
        }
      ]
    })
  }

  async run (context: Interaction.InteractionContext, args: CommandArgs): Promise<void> {
    const { query } = args
    const url = `https://api.urbandictionary.com/v0/define?term=${query}`
    const response = await fetch(url)
    const data = await response.json()
    if (data.list.length > 0) {
      let position = 0
      const components = new Components({
        timeout: 5 * (60 * 1000),
        onTimeout: async () => await context.editOrRespond({ components: [] })
      })
      const row = components.createActionRow()
      const backButton = row.createButton({
        label: '⏪',
        run: async (componentContext: ComponentContext) => {
          position = position - 1
          const embed = makeEmbed(data.list[position])
          forwardButton.setDisabled(position === data.list.length - 1)
          backButton.setDisabled(position === 0)
          await componentContext.editOrRespond({ embed, components: [new ComponentActionRow({ components: [backButton, forwardButton] })] })
        },
        disabled: true
      })
      const forwardButton = row.createButton({
        label: '⏩',
        run: async (componentContext: ComponentContext) => {
          position = position + 1
          const embed = makeEmbed(data.list[position])
          forwardButton.setDisabled(position === data.list.length - 1)
          backButton.setDisabled(position === 0)
          await componentContext.editOrRespond({ embed, components: [new ComponentActionRow({ components: [backButton, forwardButton] })] })
        }
      })
      const embed = makeEmbed(data.list[0])
      await context.editOrRespond({ embed, components })
    } else {
      await context.editOrRespond('No results found')
    }
  }
}

function stylize (text: string): string {
  const regex = /\[([\w\s]+)\]/g
  const matches = text.matchAll(regex)
  for (let match = matches.next(); !match.done!; match = matches.next()) {
    const { value } = match
    text = text.replace(value[0], `${value[0]}(https://www.urbandictionary.com/define.php?term=${encodeURIComponent(value[1])})`)
  }
  return text
}

function makeEmbed (result: any): Embed {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { word, definition, example, thumbs_up, thumbs_down, permalink } = result
  return new Embed()
    .setColor(0x6832e3)
    .setAuthor('Urban Dictionary', 'https://pbs.twimg.com/profile_images/1149416858426081280/uvwDuyqS_400x400.png', 'https://www.urbandictionary.com/')
    .setTitle(word)
    .setUrl(permalink)
    .setDescription(stylize(definition))
    .addField('Example', stylize(example))
    .addField('👍', thumbs_up, true)
    .addField('👎', thumbs_down, true)
}
