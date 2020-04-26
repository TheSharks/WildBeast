module.exports = {
  /**
   * Prereq - Check if the message author is added as a DJ
   * @param {module:eris.Message} ctx
   * @return {Boolean}
   */
  fn: (ctx) => {
    const client = require('../client')
    const player = client.voiceConnectionManager.get(ctx.channel.guild.id)
    return (player && player.controllers.includes(ctx.author.id))
  },
  errorMessage: `You're currently not added as a DJ, ask the one that started streaming to add you with \`${process.env.BOT_PREFIX}newdj\``
}
