import { ShardClient } from 'detritus-client'
import { Command as CommandClass } from '../classes/Command'
import { ApplicationCommandOption, Interaction } from 'detritus-client/lib/structures'

export interface SlashFunctionDefenition {
  enableDM?: boolean
  subcommandOf?: CommandClass
  options?: ApplicationCommandOption[]
  before?: (this: CommandClass, interaction: Interaction, shard: ShardClient) => boolean
  run: ((this: CommandClass, interaction: Interaction, shard: ShardClient) => Promise<void> | void) | null
  components?: (this: CommandClass, interaction: Interaction, shard: ShardClient) => Promise<void> | void
  after?: (this: CommandClass) => void
  success?: (this: CommandClass) => void
  failed?: (this: CommandClass, e: typeof Error) => void
}

export type CooldownTypes = 'global' | 'user' | 'channel' | 'guild'
export type CooldownDirective = {
  [k in CooldownTypes]?: number
}
export interface Command {
  name: string
  helpMessage: string
  description: string
  nsfw: boolean
  function: SlashFunctionDefenition
  cooldowns?: CooldownDirective
}
