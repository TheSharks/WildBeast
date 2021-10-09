import { Interaction } from 'detritus-client'
import { MessageComponentButtonStyles } from 'detritus-client/lib/constants'
import { ComponentActionRow, ComponentButton, ComponentContext, Components, Embed } from 'detritus-client/lib/utils'
import fetch from 'node-fetch'
import { error } from '../../utils/logger'

import { BaseSlashCommand } from '../base'

export interface CommandArgs {
  query: string
}

export default class UrbanDictionaryCommand extends BaseSlashCommand {
  description = 'Search Urban Dictionary'
  name = 'urbandictionary'

  constructor () {
    super({
      options: [
        {
          name: 'query',
          description: 'What to search for',
          required: true
        }
      ]
    })
  }

  async run (context: Interaction.InteractionContext | ComponentContext, args: CommandArgs, position: number = 0, data?: any): Promise<void> {
    const url = `https://api.urbandictionary.com/v0/define?term=${args.query}`
    const json = data ?? await (await fetch(url, {
      headers: {
        Accept: 'application/json'
      }
    })).json()
    if (json.list.length === 0) {
      await context.editOrRespond('No results found')
    } else {
      const post = json.list[position]
      const embed = new Embed()
        .setColor(0x6832e3)
        .setAuthor('Urban Dictionary', 'https://pbs.twimg.com/profile_images/1149416858426081280/uvwDuyqS_400x400.png', 'https://www.urbandictionary.com/')
        .setTitle(post.word)
        .setUrl(post.permalink)
        .setDescription(stylize(post.definition))
        .addField('Example', stylize(post.example))
        .addField('👍', post.thumbs_up, true)
        .addField('👎', post.thumbs_down, true)
      const components = new Components({
        timeout: 5 * (60 * 1000),
        onTimeout: async () => await context.editOrRespond({ components: [new ComponentActionRow({ components: [urlButton] })] }),
        onError: (context: ComponentContext, err: Error) => error(err, this.constructor.name)
      })
      components.addButton({
        emoji: '◀️',
        disabled: position === 0,
        run: async (componentContext: ComponentContext) => await this.run(componentContext, args, position - 1, json)
      })
      components.addButton({
        emoji: '▶️',
        disabled: position === json.posts.length - 1,
        run: async (componentContext: ComponentContext) => await this.run(componentContext, args, position + 1, json)
      })
      components.addButton({
        emoji: '🔀',
        disabled: position === json.posts.length - 1,
        run: async (componentContext: ComponentContext) => await this.run(componentContext, args, Math.floor(Math.random() * json.posts.length), json)
      })
      components.addButton({
        emoji: '✖️',
        style: MessageComponentButtonStyles.DANGER,
        run: async (componentContext: ComponentContext) => await componentContext.editOrRespond({ components: [new ComponentActionRow({ components: [urlButton] })] })
      })
      // workaround: detritus sets customIds even when its not needed
      const urlButton = new ComponentButton({
        style: MessageComponentButtonStyles.LINK,
        label: 'Open',
        url: post.permalink
      })
      delete urlButton.customId
      components.addButton(urlButton)
      // end workaround
      await context.editOrRespond({ embed, components })
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
