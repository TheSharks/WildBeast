const driver = require('../selectors/database-selector')

module.exports = async function (ctx) {
  const data = await driver.getSettings(ctx[0])
  if (data.welcome) {
    const message = (data.welcomeMessage) ? transform(data.welcomeMessage, ctx) : global.i18n.raw('WELCOME_MESSAGE', {
      guild_name: ctx[0].name,
      user_name: ctx[1].mention
    })
    if (data.welcome === 'dm') {
      const channel = await global.bot.users.get(ctx[1].id).getDMChannel()
      channel.createMessage(message)
    } else {
      ctx[0].channels.find(x => x.id === data.welcome).createMessage(message)
    }
  }
}

function transform (string, ctx) {
  string = string.replace(/%guild/g, ctx[0].name)
  string = string.replace(/%user/g, ctx[1].mention)
  return string
}
