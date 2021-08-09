import { ShardClient } from 'detritus-client'
import { ClientEvents } from 'detritus-client/lib/constants'
import { ButtonComponent } from './classes/ButtonComponent'
import { Command } from './classes/Command'
import { PlayerManager } from './classes/PlayerManager'
import { SelectMenuComponent } from './classes/SelectMenuComponent'

export const cache = {
  lavalink: new PlayerManager(),
  events: new Map<ClientEvents, (this: ShardClient, ...args: any) => void | Promise<void>>(),
  commands: new Map<string, Command>(),
  components: new Map<string, ButtonComponent | SelectMenuComponent>(),
  languages: new Map<string, Record<string, any>>()
}
