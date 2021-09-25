import { Interaction } from 'detritus-client'
import { MessageFlags } from 'detritus-client/lib/constants'
import driver from '../../../database/driver'
import { t } from '../../../utils/i18n'
import { error } from '../../../utils/logger'
import { BaseCommandOption } from '../../base'

export interface CommandArgs {
  name: string
  content: string
}

export class EditTagCommand extends BaseCommandOption {
  name = 'edit'
  description = 'Edit a tag you own'
  disableDm = true

  constructor () {
    super({
      options: [
        {
          name: 'name',
          description: 'The name of the tag',
          required: true,
          async onAutoComplete (context: Interaction.InteractionAutoCompleteContext): Promise<void> {
            // ¯\_(ツ)_/¯
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            const search = `${context.value}%`
            const hits = await driver`SELECT name FROM tags WHERE owner = ${context.userId} AND guild = ${context.guildId!} AND name LIKE ${search}`
            const choices = hits.map((value) => ({ name: value.name, value: value.name }))
            await context.respond({ choices })
          }
        },
        {
          name: 'content',
          description: 'The content of the tag',
          required: true
        }
      ]
    })
  }

  async run (context: Interaction.InteractionContext, args: CommandArgs): Promise<void> {
    try {
      await driver`UPDATE tags SET content = ${args.content} WHERE name = ${args.name} AND owner = ${context.userId} AND guild = ${context.guildId!}`
      await context.editOrRespond({
        content: t('commands.tag.edited'),
        embed: {
          title: args.name,
          description: args.content,
          color: 0x00ff00
        },
        flags: MessageFlags.EPHEMERAL
      })
    } catch (e) {
      error(e, this.name)
      await context.editOrRespond({
        content: t('commands.common.softFail'),
        flags: MessageFlags.EPHEMERAL
      })
    }
  }
}
