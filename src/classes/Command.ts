import { ShardClient } from 'detritus-client'
import { InteractionTypes } from 'detritus-client/lib/constants'
import { Interaction, InteractionEditOrRespond, Message } from 'detritus-client/lib/structures'
import { debug, error, info } from '../components/logger'
import { Command as CmdInterface } from '../interfaces/Command'

export interface Command extends CmdInterface {}

export class Command {
  #timeouts: Map<string, number> = new Map()

  constructor (ctx: CmdInterface) {
    Object.assign(this, ctx)
  }

  async processInteraction (interaction: Interaction, shard: ShardClient): Promise<void> {
    info(`Got an interaction tagetting ${this.name}`, 'Command')
    try {
      await interaction.respond(5)
      if (this.function.before?.apply(this, [interaction, shard]) ?? true) {
        switch (interaction.type) {
          case InteractionTypes.APPLICATION_COMMAND: {
            if (this.function.run !== null) await this.function.run.call(this, interaction, shard)
            break
          }
          case InteractionTypes.MESSAGE_COMPONENT: await this.function.components?.call(this, interaction, shard); break
        }
        this.function.success?.apply(this)
      }
    } catch (e) {
      error(e, 'Command')
      this.function.failed?.apply(this, e)
    } finally {
      debug(`Finished processing ${this.name}`, 'Command')
      this.function.after?.apply(this)
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

  toJSON (): object {
    return {
      name: this.name,
      description: this.helpMessage,
      options: this.function.options,
      defaultPermission: true
    }
  }
}
