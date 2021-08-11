import { ShardClient } from 'detritus-client'
import { Command as CommandClass } from '../classes/Command'
import { Interaction } from 'detritus-client/lib/structures'
import { RequestTypes } from 'detritus-client-rest'

export interface SlashFunctionDefenition {
  before?: (this: CommandClass, interaction: Interaction, shard: ShardClient) => Promise<boolean> | boolean
  run: (this: CommandClass, interaction: Interaction, shard: ShardClient) => Promise<void> | void
  after?: (this: CommandClass) => void
  success?: (this: CommandClass) => void
  failed?: (this: CommandClass, e: typeof Error) => void
}

export type CooldownTypes = 'global' | 'user' | 'channel' | 'guild'
export type CooldownDirective = {
  [k in CooldownTypes]?: number
}
export interface ICommand {
  name: string
  description: string
  nsfw?: boolean
  function: SlashFunctionDefenition
  cooldowns?: CooldownDirective
  enableDM?: boolean
  options?: RequestTypes.CreateApplicationCommandOption[]
}
