import { ShardClient } from 'detritus-client'
import { InteractionTypes } from 'detritus-client/lib/constants'
import { Interaction, Message } from 'detritus-client/lib/structures'
import { extname, basename } from 'path'
import { error, info } from '../components/logger'
import { Command as CmdInterface, SlashFunctionDefenition, StandardFunctionDefenition } from '../interfaces/Command'

export interface Command extends CmdInterface {}

export class Command {
  #timeouts: Map<string, number> = new Map()
  // data: CmdInterface

  constructor (ctx: CmdInterface) {
    Object.assign(this, ctx)
    // this.data = ctx
  }

  async processInteraction (interaction: Interaction, shard: ShardClient): Promise<void> {
    info('Got an interaction, trying to invoke a command', 'Command')
    const handler = this.functions.find(x => x.type === 'slash') as SlashFunctionDefenition | undefined
    if (handler === undefined) throw new Error('Trying to process an interaction for a command that has no handlers for interactions!')
    try {
      if ((handler.before?.(interaction, shard)) === true) {
        switch (interaction.type) {
          case InteractionTypes.APPLICATION_COMMAND: await handler.run?.(interaction, shard); break
          case InteractionTypes.MESSAGE_COMPONENT: await handler.components?.(interaction, shard); break
        }
        handler.success?.()
      }
    } catch (e) {
      error(e, 'Command')
      handler.failed?.(e)
    } finally {
      handler.after?.()
    }
  }

  async processMessage (message: Message, shard: ShardClient): Promise<void> {
    info('Got a message interpretation, trying to invoke a command', 'Command')
    const handler = this.functions.find(x => x.type === 'standard') as StandardFunctionDefenition | undefined
    if (handler === undefined) throw new Error('Trying to process a message for a command that has no handlers for messages!')
    try {
      if ((handler.before?.(message, shard)) === true) {
        await handler.run(message, shard)
        handler.success?.()
      }
    } catch (e) {
      error(e, 'Command')
      handler.failed?.(e)
    } finally {
      handler.after?.()
    }
  }

  toJSON (): object {
    if (this.functions.some(x => x.type === 'slash')) {
      return {
        name: basename(__filename, extname(__filename)),
        description: this.helpMessage,
        options: (this.functions.find(x => x.type === 'slash') as SlashFunctionDefenition)?.options,
        default_permission: true
      }
    } else {
      return {
        name: '',
        description: this.helpMessage
      }
    }
  }
}
