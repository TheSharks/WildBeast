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

  /**
   * Check prerequisites for this command
   * This returns an object with the calculated result, and any failed checks
   * @param {eris.Message} msg
   * @returns {Object}
   */
  runPrereqs (msg) {
    let failed = []
    if (typeof this.props.prereqs.custom === 'function') {
      let res = this.props.prereqs.custom()
      if (res !== true) failed.push(res) // we expect a string with what the error is
    }
    if (this.props.prereqs.standard.length > 0) {
      this.props.prereqs.standard.forEach(x => {
        switch (x) {
          case 'serverOwner': {
            if (msg.author.id !== msg.channel.guild.ownerID) failed.push(x)
            break
          }
          default: {
            if (!msg.member || !msg.member.permission.has(x)) failed.push(x)
            break
          }
        }
      })
    }
    return {
      passed: (failed.length === 0),
      checks: failed
    }
  }
}
