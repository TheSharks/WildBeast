import { Interaction } from 'detritus-client'
import { MessageFlags } from 'detritus-client/lib/constants'
import { PostgresError } from 'postgres'
import driver from '../../../database/driver'
import { translate } from '../../../utils/i18n'
import { error } from '../../../utils/logger'
import { BaseCommandOption } from '../../base'

export interface CommandArgs {
  name: string
  content: string
}

export class CreateTagCommand extends BaseCommandOption {
  name = 'create'
  description = this.translateThis('metadata.descriptions.create')
  disableDm = true

  constructor () {
    super({
      options: [
        {
          name: 'name',
          description: translate('slash-commands.tag.metadata.options.name'),
          required: true
        },
        {
          name: 'content',
          description: translate('slash-commands.tag.metadata.options.content'),
          required: true
        }
      ]
    })
  }

  async run (context: Interaction.InteractionContext, args: CommandArgs): Promise<void> {
    try {
      await driver`INSERT INTO tags (name, content, owner, guild) VALUES (${args.name}, ${args.content}, ${context.userId}, ${context.guildId!})`
      await context.editOrRespond({
        content: this.translateThis('created'),
        embed: {
          title: args.name,
          description: args.content,
          color: 0x00ff00
        },
        flags: MessageFlags.EPHEMERAL
      })
    } catch (e) {
      if (e instanceof PostgresError) {
        if (e.code === '23505') {
          await context.editOrRespond({
            content: this.translateThis('errors.conflict'),
            flags: MessageFlags.EPHEMERAL
          })
        }
      } else {
        error(e, this.constructor.name)
        await context.editOrRespond({
          content: translate('common.softFail'),
          flags: MessageFlags.EPHEMERAL
        })
      }
    }
  }
}
