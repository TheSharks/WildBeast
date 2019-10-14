const prereqs = require('../internal/dir-require')('src/components/prereqs/*.js')
/**
 * Represents a command
 * @type {module.Command}
 */
module.exports = class Command {
  constructor (fn, props) {
    if (typeof fn === 'function') this.fn = fn
    else throw new TypeError('Fn param must be a function')
    this.props = {
      category: 'Uncategorized',
      helpMessage: '[help message not set]',
      accessLevel: 0,
      hidden: false,
      standardPrereqs: [],
      customPrereqs: [],
      ...props
    }
  }
  /**
   * Run the command instantly
   * @param {module:eris.Message} msg
   * @param {String} suffix
   * @returns {Function}
   */
  run (msg, suffix) {
    return this.fn(msg, suffix)
  }

  /**
   * Check prerequisites for this command, and run the command
   * @param {module:eris.Message} msg
   * @param {String} suffix
   * @returns {Function | Promise}
   */
  runWithPrereqs (msg, suffix) {
    // run customs first
    for (const x of this.props.customPrereqs) {
      if (!prereqs[x]) throw new TypeError(`Attempting to use a custom prereq that does not exist: ${x}`)
      if (!prereqs[x].fn(msg)) return msg.channel.createMessage(prereqs[x].errorMessage)
    }
    // then, run default perm checks
    if (!msg.member) return msg.channel.createMessage('This command cannot be used in DMs') // assumption, if discord perms are needed this is likely a guild-only command
    const missingPerms = this.props.standardPrereqs.filter(x => !msg.member.permission.has(x))
    if (missingPerms.length > 0) { return msg.channel.createMessage(`You're missing the following permissions: \`${missingPerms.join(', ')}\``) }
    return this.run(msg, suffix)
  }
}
