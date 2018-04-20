const driver = require('../internal/database-selector')
const compiler = require('jagtag-js')
const blacklist = [
  'create',
  'raw',
  'owner',
  'delete'
]

module.exports = {
  meta: {
    level: 0,
    timeout: 0,
    alias: ['t'],
    help: 'Tags!'
  },
  fn: async (msg, suffix) => {
    const parts = suffix.split(' ')
    switch (parts[0]) {
      case 'create': {
        const tag = await driver.getTag(parts[1])
        if (tag) return global.i18n.send('TAG_NAME_CONFLICT', msg.channel)
        if (blacklist.includes(parts[1])) return global.i18n.send('TAG_NAME_BLACKLISTED', msg.channel)
        await driver.create('tags', {
          _key: parts[1],
          content: parts.slice(2).join(' '),
          owner: msg.author.id
        })
        return global.i18n.send('TAG_CREATED', msg.channel, {
          tag: parts[1]
        })
      }
      case 'raw': {
        const tag = await driver.getTag(parts[1])
        if (!tag) {
          return global.i18n.send('TAG_NOT_FOUND', msg.channel, {
            tag: parts[1]
          })
        } else {
          msg.channel.createMessage('`' + tag.content + '`')
        }
        break
      }
      case 'owner': {
        const tag = await driver.getTag(parts[1])
        if (!tag) {
          return global.i18n.send('TAG_NOT_FOUND', msg.channel, {
            tag: parts[1]
          })
        } else {
          const owner = await global.bot.getRESTUser(tag.owner)
          return global.i18n.send('TAG_OWNER', msg.channel, {
            tag: parts[1],
            owner: `${owner.username}#${owner.discriminator}`
          })
        }
      }
      case 'delete': {
        const tag = await driver.getTag(parts[1])
        if (!tag) {
          return global.i18n.send('TAG_NOT_FOUND', msg.channel, {
            tag: suffix
          })
        }
        if (tag.owner !== msg.author.id && !process.env['WILDBEAST_MASTERS'].split('|').includes(msg.author.id)) {
          return global.i18n.send('TAG_NOT_OWNED', msg.channel)
        }
        await driver.delete('tags', parts.slice(1).join(' '))
        return global.i18n.send('TAG_DELETED', msg.channel, {
          tag: parts.slice(1).join(' ')
        })
      }
      default: {
        const tag = await driver.getTag(suffix)
        if (!tag) {
          return global.i18n.send('TAG_NOT_FOUND', msg.channel, {
            tag: suffix
          })
        } else {
          msg.channel.createMessage(compiler(tag.content, {
            tagArgs: parts.slice(2),
            author: msg.author,
            channel: msg.channel,
            guild: msg.channel.guild,
            channels: msg.channel.guild.channels,
            members: msg.channel.guild.members
          }))
        }
        break
      }
    }
  }
}
