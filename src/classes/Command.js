const prereqs = require('../internal/dir-require')('src/components/prereqs/*.js')
const client = require('../components/client')
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
      nsfw: false,
      disableDM: false,
      standardPrereqs: {
        channel: [],
        guild: []
      },
      customPrereqs: [],
      aliases: [],
      requiredPermissions: {
        channel: [],
        guild: []
      },
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
    if (!this.fn || typeof this.fn !== 'function') throw new TypeError(`Expected type 'function', got ${typeof this.fn}`)
    else return this.fn(msg, suffix)
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
    if (this.props.disableDM && !msg.channel.guild) return msg.channel.createMessage('This command cannot be used in DMs')
    // then, run default perm checks
    if (this.props.requiredPermissions.channel.length > 0 || this.props.requiredPermissions.guild.length > 0) {
      if (!msg.member) return msg.channel.createMessage('This command cannot be used in DMs')
      const missingPerms = [
        ...this.props.requiredPermissions.guild.filter(x => !!msg.channel.guild.members.get(client.user.id).permission.has(x)),
        ...this.props.requiredPermissions.channel.filter(x => !!msg.channel.permissionsOf(client.user.id).has(x))
      ]
      if (missingPerms.length > 0) return msg.channel.createMessage(`I'm missing the following permissions: \`${missingPerms.join(', ')}\``)
    }
    if (this.props.standardPrereqs.channel.length > 0 || this.props.standardPrereqs.guild.length > 0) {
      if (!msg.member) return msg.channel.createMessage('This command cannot be used in DMs') // assumption, if discord perms are needed this is likely a guild-only command
      const missingPerms = [
        ...this.props.standardPrereqs.guild.filter(x => !msg.member.permission.has(x)),
        ...this.props.standardPrereqs.channel.filter(x => !msg.channel.permissionsOf(msg.member.id).has(x))
      ]
      if (missingPerms.length > 0) return msg.channel.createMessage(`You're missing the following permissions: \`${missingPerms.join(', ')}\``)
    }
    return this.run(msg, suffix)
  }
}
