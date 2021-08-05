import { ShardClient } from 'detritus-client'
import { ClientEvents } from 'detritus-client/lib/constants'
import { Interaction } from 'detritus-client/lib/structures'
import { Command } from './classes/Command'
import { PlayerManager } from './classes/PlayerManager'

export const cache = {
  lavalink: new PlayerManager(),
  events: new Map<ClientEvents, (this: ShardClient, ...args: any) => void | Promise<void>>(),
  commands: new Map<string, Command>(),
  components: new Map<string, (this: ShardClient, interaction: Interaction) => void | Promise<void>>(),
  languages: new Map<string, Record<string, any>>()
}
