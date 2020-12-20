const logger = require('../internal/logger')
const commands = require('./commands')

module.exports = {
  execute: (ctx) => {
    if (commands.commands[ctx.data.name]) {
      logger.info('INTERACTIONS', `Received an interaction for command ${ctx.data.name}`)
      commands.commands[ctx.data.name].run(ctx)
    }
  },
  check: async () => {
    const client = require('./client')
    const data = await client.rest.request({
      method: 'GET',
      url: `https://discord.com/api/v8/applications/${client.application.id}/guilds/110462143152803840/commands`
    })
    return data
  },
  register: async () => {
    logger.log('INTERACTIONS', 'Checking if new interactions need to be registered...')
    const client = require('./client')
    const interactions = (await module.exports.check()).map(x => x.name)
    const data = Object.keys(commands.commands)
      .filter(x => !commands.commands[x].props.hidden)
      .map(x => {
        return {
          name: x,
          ...(commands.commands[x].toJSON())
        }
      })
      .filter(x => !interactions.includes(x.name))
    if (data.length > 0) {
      logger.log('INTERACTIONS', `Registering ${data.length} new interactions with Discord`)
      data.forEach(async x => {
        await client.rest.request({
          method: 'POST',
          url: `https://discord.com/api/v8/applications/${client.application.id}/guilds/110462143152803840/commands`,
          body: x
        })
      })
    } else logger.log('INTERACTIONS', 'No new interactions to register')
  }
}
