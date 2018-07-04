module.exports = {
  meta: {
    help: "Returns the bot's invite URL",
    module: 'Util',
    level: 0,
    timeout: 5
  },
  fn: async function (msg) {
    if (process.env.WILDBEAST_INVITE_OVERRIDE) {
      return global.i18n.send('INVITE_GENERATED_RESULT', msg.channel, {
        invite: process.env.WILDBEAST_INVITE_OVERRIDE
      })
    }
    const app = await global.bot.getOAuthApplication()
    if (!app.bot_public) {
      return global.i18n.send('INVITE_BOT_PRIVATE', msg.channel, {
        owner: `${app.owner.username}#${app.owner.discriminator}`
      })
    } else {
      return global.i18n.send('INVITE_GENERATED_RESULT', msg.channel, {
        invite: `https://discordapp.com/oauth2/authorize?&client_id=${app.id}&scope=bot`
      })
    }
  }
}
