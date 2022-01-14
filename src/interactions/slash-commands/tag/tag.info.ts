import { Interaction } from 'detritus-client'
import { MessageFlags } from 'detritus-client/lib/constants'
import driver from '../../../database/driver'
import { Tag } from '../../../database/models/Tag'
import { translate } from '../../../utils/i18n'
import { error } from '../../../utils/logger'
import { BaseCommandOption } from '../../base'

export interface CommandArgs {
  name: string
  args?: string
}

export class TagInfoCommand extends BaseCommandOption {
  name = 'info'
  description = 'Show info about a tag'
  disableDm = true

  constructor () {
    super({
      options: [
        {
          name: 'name',
          description: 'The name of the tag',
          required: true,
          async onAutoComplete (context: Interaction.InteractionAutoCompleteContext): Promise<void> {
            const search = `${context.value}%`
            const hits = await driver`SELECT name FROM tags WHERE guild = ${context.guildId!} AND name LIKE ${search} ORDER BY name LIMIT 10`
            const choices = hits.map((value) => ({ name: value.name, value: value.name }))
            await context.respond({ choices })
          }
        }
      ]
    })
  }

  async onBeforeRun (context: Interaction.InteractionContext, args: CommandArgs): Promise<boolean> {
    const tag = await driver`SELECT name FROM tags WHERE name = ${args.name} AND guild = ${context.guildId!}`
    if (tag.length === 0) {
      await context.editOrRespond({
        content: translate('commands.tag.errors.notFound'),
        flags: MessageFlags.EPHEMERAL
      })
      return false
    } return true
  }

  async run (context: Interaction.InteractionContext, args: CommandArgs): Promise<void> {
    try {
      const tag = (await driver`SELECT name, content, owner, created_at, updated_at, uses FROM tags WHERE name = ${args.name} AND guild = ${context.guildId!} LIMIT 1`)[0] as Tag
      const ranking = (await driver`SELECT name FROM tags WHERE guild = ${context.guildId!} ORDER BY uses DESC`).map((value) => value.name)
      const owner = await context.client.rest.fetchUser(tag.owner)
      await context.editOrRespond({
        embed: {
          title: args.name,
          description: tag.content,
          color: 0x00ff00,
          author: {
            name: owner.username,
            iconUrl: owner.avatarUrl
          },
          fields: [
            {
              name: 'Created At',
              value: `<t:${Math.round(new Date(tag.created_at).getTime() / 1000)}:D>`,
              inline: true
            },
            {
              name: 'Updated At',
              value: `<t:${Math.round(new Date(tag.updated_at).getTime() / 1000)}:D>`,
              inline: true
            },
            {
              name: 'Ranking',
              value: `Used ${tag.uses} times, ${ranking.indexOf(args.name) + 1}/${ranking.length}`,
              inline: true
            }
          ]
        }
      })
    } catch (e) {
      error(e, this.constructor.name)
      await context.editOrRespond({
        content: translate('commands.common.softFail'),
        flags: MessageFlags.EPHEMERAL
      })
    }
  }
}
