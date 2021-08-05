import client from './client'
import { cache } from '../cache'
import { APIApplicationCommand } from 'discord-api-types/v9'
import { debug, info, trace, warn } from './logger'

export async function update (): Promise<void> {
  // const current = await client.rest.fetchApplicationCommands(client.applicationId) as APIApplicationCommand[]
  const current = await client.rest.fetchApplicationGuildCommands(client.applicationId, '110462143152803840') as APIApplicationCommand[]
  trace(current, 'Interactions')
  info(`${current.length} commands currently registered, we know about ${cache.commands.size}`, 'Interactions')
  current
    .forEach(x => {
      // call commands by ID instead of by name
      const command = cache.commands.get(x.name)
      if (command === undefined) {
        warn(`Command ${x.name} registered as ${x.id} but not found in cache!`, 'Interactions')
      } else {
        debug(`Command ${x.name} registered as ${x.id}`, 'Interactions')
        cache.commands.set(x.id, command)
        cache.commands.delete(x.name)
      }
    })

  // do we have to register new commands?
  if (current.length !== cache.commands.size) {
    info('Since cache isn\'t even with register, trying to register new commands', 'Interactions')
    const toRegister = cache.commands.values()
    while (true) {
      const next = toRegister.next()
      if (next.done === true) break
      const command = next.value
      if (!current.some(x => x.name === command.name)) {
        info(`Registering new command ${command.name}`, 'Interactions')
        const resp = await client.rest.createApplicationCommand(client.applicationId, command) as APIApplicationCommand
        debug(`Successfully registered new command ${resp.name} with ID ${resp.id}`, 'Interactions')
        const cmd = cache.commands.get(resp.name)
        cache.commands.set(resp.id, cmd!)
        cache.commands.delete(resp.name)
      }
    }
  }
}
