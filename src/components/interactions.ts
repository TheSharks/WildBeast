import client from './client'
import { cache } from '../cache'
import { APIApplicationCommand } from 'discord-api-types/v9'
import { debug, info, trace, warn } from '../internal/logger'
import { deepStrictEqual } from 'assert'

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
        // const resp = await client.rest.createApplicationCommand(client.applicationId, command) as APIApplicationCommand
        const resp = await client.rest.createApplicationGuildCommand(client.applicationId, '110462143152803840', command) as APIApplicationCommand
        debug(`Successfully registered new command ${resp.name} with ID ${resp.id}`, 'Interactions')
        const cmd = cache.commands.get(resp.name)
        cache.commands.set(resp.id, cmd!)
        cache.commands.delete(resp.name)
      }
    }
  }

  // do we have to update current commands?
  const toUpdate = current
    .filter(x => cache.commands.has(x.id))
    .filter(x =>
      cache.commands.get(x.id)!.description !== x.description ||
      cache.commands.get(x.id)!.toJSON().defaultPermission !== x.default_permission ||
      !equals(cache.commands.get(x.id)!.options, x.options)
    )
  if (toUpdate.length > 0) {
    info(`Updating ${toUpdate.length} command(s)`, 'Interactions')
    toUpdate.forEach(async x => {
      const command = cache.commands.get(x.id)!
      // const resp = await client.rest.editApplicationCommand(x.application_id, x.id, command) as APIApplicationCommand
      const resp = await client.rest.editApplicationGuildCommand(x.application_id, '110462143152803840', x.id, command.toJSON()) as APIApplicationCommand
      debug(`Successfully updated command ${resp.name} with ID ${resp.id}`, 'Interactions')
    })
  } else debug('No commands to update', 'Interactions')
}

const equals = (a: any, b: any): boolean => {
  try {
    deepStrictEqual(a, b)
    return true
  } catch (_) {
    return false
  }
}
