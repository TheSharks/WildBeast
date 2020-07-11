module.exports = {
  /**
   * Prereq - Check if the message author is added as a DJ
   * @param {module:eris.Message} ctx
   * @return {Boolean}
   */
  fn: (ctx) => {
    const masters = process.env.WILDBEAST_MASTERS.split(',')
    if (ctx.author.id === ctx.channel.guild.ownerID || masters.includes(ctx.author.id)) return true
    const client = require('../client')
    const player = client.voiceConnectionManager.get(ctx.channel.guild.id)
    return (player && player.controllers.includes(ctx.author.id))
  },
  errorMessage: (ctx) => {
    const client = require('../client')
    const player = client.voiceConnectionManager.get(ctx.channel.guild.id)
    if (!player) return "I'm not currently streaming in this server"
    else return `You're currently not added as a DJ, ask the one that started streaming to add you with \`${process.env.BOT_PREFIX}newdj\``
  }
}
