/**
 * Represents a command
 * @type {module.Command}
 */
module.exports = class Command {
  constructor (fn, props) {
    if (typeof fn === 'function') this.fn = fn
    else throw new TypeError('Fn param must be a function')
    this.props = {
      helpMessage: '[help message not set]',
      accessLevel: 0,
      hidden: false,
      prereqs: {
        standard: [],
        custom: null
      },
      ...props
    }
  }
  /**
   * Run the command
   * @param {eris.Message} msg
   * @param {String} suffix
   * @returns {Function}
   */
  run (msg, suffix) {
    return this.fn(msg, suffix)
  }
}
