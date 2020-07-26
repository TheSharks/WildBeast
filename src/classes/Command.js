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
      hidden: false,
      nsfw: false,
      disableDM: false,
      userPerms: {},
      clientPerms: {},
      prereqs: [],
      aliases: [],
      cooldowns: {},
      ...props
    }
    this._timeouts = new Map()
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
    const prereqs = require('../internal/dir-require')('src/components/prereqs/*.js')
    const client = require('../components/client')
    if (this.props.disableDM && !msg.channel.guild) return this.safeSendMessage(msg.channel, 'This command cannot be used in DMs')
    // run customs first
    for (const x of this.props.prereqs) {
      if (!prereqs[x]) throw new TypeError(`Attempting to use a custom prereq that does not exist: ${x}`)
      if (!prereqs[x].fn(msg)) return this.safeSendMessage(msg.channel, prereqs[x].errorMessage(msg))
    }
    if (this.props.nsfw && msg.channel.guild && !msg.channel.nsfw) {
      return this.safeSendMessage(msg.channel, 'This channel needs to be marked as NSFW before this command can be used')
    }
    if (this.shouldCooldown(msg)) return this.safeSendMessage(msg.channel, 'This command is on cooldown, try again later')
    if (msg.channel.guild) {
      if (Object.keys(this.props.clientPerms).length > 0) {
        const missingPerms = [
          ...(this.props.clientPerms.guild && Array.isArray(this.props.clientPerms.guild)
            ? this.props.clientPerms.guild.filter(x => !msg.channel.guild.members.get(client.user.id).permission.has(x))
            : []),
          ...(this.props.clientPerms.channel && Array.isArray(this.props.clientPerms.channel)
            ? this.props.clientPerms.channel.filter(x => !msg.channel.permissionsOf(client.user.id).has(x))
            : [])
        ]
        if (missingPerms.length > 0) return this.safeSendMessage(msg.channel, `I'm missing the following permissions: \`${missingPerms.join(', ')}\``)
      }
      if (Object.keys(this.props.userPerms).length > 0) {
        const missingPerms = [
          ...(this.props.userPerms.guild && Array.isArray(this.props.userPerms.guild)
            ? this.props.userPerms.guild.filter(x => !msg.member.permission.has(x))
            : []),
          ...(this.props.userPerms.channel && Array.isArray(this.props.userPerms.channel)
            ? this.props.userPerms.channel.filter(x => !msg.channel.permissionsOf(msg.member.id).has(x))
            : [])
        ]
        if (missingPerms.length > 0) return this.safeSendMessage(msg.channel, `You're missing the following permissions: \`${missingPerms.join(', ')}\``)
      }
    }
    return this.run(msg, suffix)
  }

  /**
   * Try to send a message to a channel with regards to the channel's permissions
   * @param {module:eris.TextChannel} channel The channel where to send the message to
   * @param {String | Object} msg The message to send
   * @see {@link https://abal.moe/Eris/docs/TextChannel#function-createMessage}
   */
  async safeSendMessage (channel, msg) {
    const client = require('../components/client')
    if (channel.guild && !channel.permissionsOf(client.user.id).has('sendMessages')) return Promise.reject(new Error('No permissions to create messages in this channel'))
    return channel.createMessage({
      ...((typeof msg === 'string') ? { content: msg } : msg),
      allowedMentions: {
        everyone: false,
        roles: false,
        users: false
      }
    })
  }

  /**
   * Check if the command needs to cooldown before it can be used again
   * @param {module:eris.Message} ctx
   * @return {Boolean}
   */
  shouldCooldown (ctx) {
    const keys = Object.keys(this.props.cooldowns)
    if (keys.length === 0) return false
    const check = (key, ctx) => {
      const timeout = this._timeouts.get(key)
      if (!timeout) {
        this._timeouts.set(key, Date.now())
        return false
      }
      if (Date.now() - timeout < this.props.cooldowns[ctx]) return timeout
      this._timeouts.delete(key)
      return false
    }
    // cooldowns get checked in order of how the command declared them
    const final = keys.map(element => {
      switch (element) {
        case 'global':
          return check('global', element)
        case 'channel':
          return check(ctx.channel.id, element)
        case 'guild':
          return check(ctx.channel.guild ? ctx.channel.guild.id : ctx.channel.id, element)
        case 'user':
          return check(ctx.author.id, element)
        default:
          logger.warn('CMD', `Unknown cooldown directive! ${element} is unknown`)
          return false
      }
    })
    return final.some(x => typeof x === 'number')
  }
}
