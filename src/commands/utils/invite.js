const Command = require('../../classes/Command')

module.exports = new Command(async function (msg) {
  if (process.env.WILDBEAST_INVITE_OVERRIDE) {
    return this.safeSendMessage(msg.channel, `Use the following link to invite me: ${process.env.WILDBEAST_INVITE_OVERRIDE}`)
  }
  const app = await require('../../components/client').getOAuthApplication()
  if (!app.bot_public) {
    if (!app.team) return this.safeSendMessage(msg.channel, `This bot is marked as private, please ask ${app.owner.username}#${app.owner.discriminator} to invite me to your server`)
    else {
      const teamowner = app.team.members.find(x => x.user.id === app.team.owner_user_id)
      return this.safeSendMessage(msg.channel, `This bot is marked as private, please ask ${teamowner.user.username}#${teamowner.user.discriminator} to invite me to your server`)
    }
  } else {
    return this.safeSendMessage(msg.channel, `Use the following link to invite me: https://discordapp.com/oauth2/authorize?&client_id=${app.id}&scope=bot`)
  }
})
