module.exports = {
  /**
   * Prereq - Check if the message author is a master user
   * @param {module:eris.Message} ctx
   * @return {Boolean}
   */
  fn: (ctx) => {
    const masters = process.env.WILDBEAST_MASTERS.split(',')
    return masters.includes(ctx.author.id)
  },
  errorMessage: () => i18n.t('prereqs.errors.masterUser')
}
