module.exports = {
  /**
   * Prereq - Check if the message author is the server owner
   * @param {module:eris.Message} ctx
   * @return {Boolean}
   */
  fn: (ctx) => {
    return ctx.author.id === ctx.channel.guild.ownerID
  },
  errorMessage: () => i18n.t('prereqs.errors.serverOwner')
}
