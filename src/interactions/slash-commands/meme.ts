import { Interaction } from 'detritus-client'
import { MessageComponentButtonStyles } from 'detritus-client/lib/constants'
import { ComponentActionRow, ComponentButton, ComponentContext, Components, Embed } from 'detritus-client/lib/utils'
import fetch from 'node-fetch'
import { translate } from '../../utils/i18n'
import { error } from '../../utils/logger'

import { BaseSlashCommand } from '../base'

export default class RandomMemeCommand extends BaseSlashCommand {
  name = 'meme'
  description = this.translateThis('metadata.description')
  triggerLoadingAfter = 2000

  async run (context: Interaction.InteractionContext | ComponentContext): Promise<void> {
    const res = await fetch('https://reddit.com/r/memes/random.json')
    const json = await res.json()
    const post = json[0].data.children[0].data

    const embed = new Embed()
      .setTitle(post.title)
      .setImage(post.url)
      .addField('👍', post.score, true)
      .addField('💬', post.num_comments, true)
      .setTimestamp(post.created_utc * 1000)
      .setFooter(post.subreddit_name_prefixed, 'https://www.redditinc.com/assets/images/site/reddit-logo.png')
      .setColor(0xff4500)

    const components = new Components({
      timeout: 5 * (60 * 1000),
      onTimeout: async () => await context.editOrRespond({ components: [new ComponentActionRow({ components: [urlButton] })] }),
      onError: (context: ComponentContext, err: Error) => error(err, this.constructor.name)
    })
    components.addButton({
      emoji: '🔄',
      run: async (componentContext: ComponentContext) => await this.run(componentContext)
    })
    const urlButton = new ComponentButton({
      style: MessageComponentButtonStyles.LINK,
      label: translate('common.open'),
      url: `https://reddit.com${post.permalink as string}`
    })
    components.addButton(urlButton)

    await context.editOrRespond({ embed, components })
  }
}
