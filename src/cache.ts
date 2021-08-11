import { ShardClient } from 'detritus-client'
import { ClientEvents } from 'detritus-client/lib/constants'
import { Command } from './classes/Command'
import { PlayerManager } from './classes/PlayerManager'
import { Components } from './types/components'

export const cache = {
  lavalink: new PlayerManager(),
  events: new Map<ClientEvents, (this: ShardClient, ...args: any) => void | Promise<void>>(),
  commands: new Map<string, Command>(),
  components: new Map<string, Components>(),
  languages: new Map<string, Record<string, any>>()
}
