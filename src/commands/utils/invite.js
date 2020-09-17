const Command = require('../../classes/Command')

module.exports = new Command(async function (msg) {
  if (process.env.WILDBEAST_INVITE_OVERRIDE) {
    return this.safeSendMessage(msg.channel, i18n.t('commands.invite.done', { invite: process.env.WILDBEAST_INVITE_OVERRIDE }))
  }
  const app = await require('../../components/client').getOAuthApplication()
  if (!app.bot_public) {
    if (!app.team) return this.safeSendMessage(msg.channel, i18n.t('commands.invite.private', { owner: `${app.owner.username}#${app.owner.discriminator}` }))
    else {
      const teamowner = app.team.members.find(x => x.user.id === app.team.owner_user_id)
      return this.safeSendMessage(msg.channel, i18n.t('commands.invite.private', { owner: `${teamowner.user.username}#${teamowner.user.discriminator}` }))
    }
  } else {
    return this.safeSendMessage(msg.channel, i18n.t('commands.invite.done', { invite: `https://discordapp.com/oauth2/authorize?&client_id=${app.id}&scope=bot` }))
  }
})
