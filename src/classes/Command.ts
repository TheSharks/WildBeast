import { ShardClient } from 'detritus-client'
import { Interaction, InteractionEditOrRespond, Message } from 'detritus-client/lib/structures'
import { debug, error, info } from '../internal/logger'
import { ICommand } from '../interfaces/Command'
import { RequestTypes } from 'detritus-client-rest'
import { t } from '../internal/i18n'

export interface Command extends ICommand {}

export class Command {
  #timeouts: Map<string, number> = new Map()

  constructor (ctx: ICommand) {
    Object.assign(this, ctx)
  }

  async processInteraction (interaction: Interaction, shard: ShardClient): Promise<void> {
    info(`Got an interaction tagetting ${this.name}`, 'Command')
    try {
      await interaction.respond(5) // ack
      if (this.function.before?.call(this, interaction, shard) ?? true) {
        await this.function.run.call(this, interaction, shard)
        this.function.success?.call(this)
      }
    } catch (e) {
      const uuid = error(e, 'Command')
      if (!interaction.responded) {
        await interaction.editOrRespond(t('commands.common.failedToRun', { uuid }))
      }
      this.function.failed?.call(this, e)
    } finally {
      debug(`Finished processing ${this.name}`, 'Command')
      this.function.after?.call(this)
    }
  }

  async safeReply (interaction: Interaction, message: string | InteractionEditOrRespond): Promise<Message> {
    return await interaction.editOrRespond({
      ...((typeof message === 'string') ? { content: message } : message),
      allowedMentions: {
        parse: []
      }
    }) as Message
  }

  toJSON (): { name: string, description: string, options?: RequestTypes.CreateApplicationCommandOption[], defaultPermission: boolean } {
    return {
      name: this.name,
      description: this.description,
      options: this.options,
      defaultPermission: true
    }
  }
}
