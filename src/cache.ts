import { ClusterClient } from 'detritus-client'
import { ClientEvents } from 'detritus-client/lib/constants'
import { Command } from './classes/Command'
import { PlayerManager } from './classes/PlayerManager'

export const cache = {
  lavalink: new PlayerManager(),
  events: new Map<ClientEvents, (this: ClusterClient, ...args: any) => void | Promise<void>>(),
  commands: new Map<string, Command>()
}
