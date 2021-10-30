import { Interaction } from 'detritus-client'
import { translate } from '../../../utils/i18n'
import { BaseCommandOption } from '../../base'
import fetch from 'node-fetch'
import { Components, Embed, ComponentContext, ComponentButton, ComponentActionRow } from 'detritus-client/lib/utils'
import { MessageComponentButtonStyles } from 'detritus-client/lib/constants'
import { error } from '../../../utils/logger'

// no import - messes with tsc (package.json is outside the source dir)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../../../package.json')

export interface CommandArgs {
  query: string
}

export class BooruE621Command extends BaseCommandOption {
  name = 'e621'
  description = 'Query e621'
  triggerLoadingAfter = 2000

  constructor () {
    super({
      options: [
        {
          name: 'query',
          description: 'What to search for',
          required: true,
          async onAutoComplete (context: Interaction.InteractionAutoCompleteContext): Promise<void> {
            const chunks = context.value.split(' ')
            const search = chunks.pop()
            if (search === undefined || search.length < 1) await context.respond({ choices: [] })
            const q = new URLSearchParams({
              'search[name_matches]': search!,
              expiry: '7'
            })
            const url = (context.channel !== null && !context.channel.nsfw) ? `https://e926.net/tags/autocomplete.json?${q.toString()}` : `https://e621.net/tags/autocomplete.json?${q.toString()}`
            const json = await (await fetch(url, {
              headers: {
                Accept: 'application/json',
                'User-Agent': `wildbeast/${version as string} (Dougley, hey@dougley.com)`
              }
            })).json()
            // theres more info in the json, but it's not useful
            const choices = json.map((x: {name: string}) => ({ name: `${chunks.join(' ')} ${x.name}`.trim(), value: `${chunks.join(' ')} ${x.name}`.trim() }))
            await context.respond({ choices })
          }
        }
      ]
    })
  }

  async run (context: Interaction.InteractionContext | ComponentContext, args: CommandArgs, position: number = 0, data?: any): Promise<void> {
    const q = new URLSearchParams({
      limit: '50',
      tags: args.query
    })
    const url = (context.channel !== null && !context.channel.nsfw) ? `https://e926.net/posts.json?${q.toString()}` : `https://e621.net/posts.json?${q.toString()}`
    const json = data ?? await (await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': `wildbeast/${version as string} (Dougley, hey@dougley.com)`
      }
    })).json()
    if (json.posts.length === 0) {
      await context.editOrRespond(translate('commands.common.noResultsFor', { query: args.query }))
    } else {
      const post = json.posts[position]
      const artist: string = post.tags.artist.filter((x: string) => !['conditional_dnp'].includes(x))[0] ?? 'Unknown'
      const embed = new Embed()
        .setAuthor(artist, 'https://en.wikifur.com/w/images/d/dd/E621Logo.png', artist === 'Unknown' ? undefined : `https://e621.net/artists/show_or_new?name=${encodeURIComponent(artist)}`)
        .setImage(post.file.url)
        .addField('Score', `${post.score.up as string} 👍 ${post.score.down as string} 👎`, true)
        .addField('Favorites', post.fav_count, true)
      if (context.channel !== null && !context.channel.nsfw) embed.setFooter('e926.net - NSFW disabled', 'https://en.wikifur.com/w/images/d/dd/E621Logo.png')
      else embed.setFooter('e621.net', 'https://en.wikifur.com/w/images/d/dd/E621Logo.png')
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
        label: translate('commands.common.open'),
        url: `https://e621.net/posts/${post.id as string}`
      })
      delete urlButton.customId
      components.addButton(urlButton)
      // end workaround
      await context.editOrRespond({ embed, components })
    }
  }
}
