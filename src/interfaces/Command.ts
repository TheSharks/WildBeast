import { ShardClient } from 'detritus-client'
import { Command as CommandClass } from '../classes/Command'
import { ApplicationCommandOption, Interaction, Message } from 'detritus-client/lib/structures'

export interface SlashFunctionDefenition {
  type: 'slash'
  enableDM?: boolean
  subcommandOf?: CommandClass
  options?: ApplicationCommandOption[]
  before?: (interaction: Interaction, shard: ShardClient) => boolean
  run?: (interaction: Interaction, shard: ShardClient) => Promise<void> | void
  components?: (interaction: Interaction, shard: ShardClient) => Promise<void> | void
  after?: () => void
  success?: () => void
  failed?: (e: typeof Error) => void
}

export interface StandardFunctionDefenition {
  type: 'standard'
  enableDM?: boolean
  before?: (message: Message, shard: ShardClient) => boolean
  run: (message: Message, shard: ShardClient) => Promise<void> | void
  after?: () => void
  success?: () => void
  failed?: (e: typeof Error) => void
}

export interface Command {
  helpMessage: string
  description: string
  nsfw: boolean
  functions: [StandardFunctionDefenition] | [SlashFunctionDefenition] | [SlashFunctionDefenition, StandardFunctionDefenition]
}
