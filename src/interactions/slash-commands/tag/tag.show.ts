import Parser from '@thesharks/jagtag-js'
import { Interaction } from 'detritus-client'
import { MessageFlags } from 'detritus-client/lib/constants'
import driver from '../../../database/driver'
import { translate } from '../../../utils/i18n'
import { error } from '../../../utils/logger'
import { BaseCommandOption } from '../../base'

export interface CommandArgs {
  name: string
  args?: string
}

export class ShowTagCommand extends BaseCommandOption {
  name = 'show'
  description = 'Show a tag'
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
            const hits = await driver`SELECT name FROM tags WHERE owner = ${context.userId} AND guild = ${context.guildId!} AND name LIKE ${search} ORDER BY name LIMIT 10`
            const choices = hits.map((value) => ({ name: value.name, value: value.name }))
            await context.respond({ choices })
          }
        },
        {
          name: 'args',
          description: 'Arguments to pass to the tag',
          required: false
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
      const tag = await driver`SELECT content FROM tags WHERE name = ${args.name} AND guild = ${context.guildId!} LIMIT 1`
      const content = tag[0].content
      await context.editOrRespond({
        content: Parser(content, {
          tagArgs: args.args?.split(' ') ?? [],
          user: context.user,
          guild: context.guild,
          channel: context.channel
        })
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
