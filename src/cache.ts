import { ShardClient } from 'detritus-client'
import { ClientEvents } from 'detritus-client/lib/constants'

export const cache = {
  events: new Map<ClientEvents, (this: ShardClient, ...args: any) => void | Promise<void>>(),
  languages: new Map<string, Record<string, any>>()
}
