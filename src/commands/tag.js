const driver = require('../selectors/database-selector')
const compiler = require('@thesharks/jagtag-js')
const blacklist = [
  'create',
  'raw',
  'owner',
  'edit',
  'delete'
]

module.exports = {
  meta: {
    help: 'Base command for tags. Returns a tag if specified.',
    usage: '<subcommand/tag name>',
    module: 'Tags',
    level: 0,
    alias: ['t'],
    addons: [
      'For a list of available subcommands, see https://docs.thesharks.xyz/commands/#tags.'
    ]
  },
  fn: async (msg, suffix) => {
    const parts = suffix.split(' ')
    switch (parts[0]) {
      case 'create': {
        const tag = await driver.getTag(parts[1])
        if (tag) return global.i18n.send('TAG_NAME_CONFLICT', msg.channel)
        if (blacklist.includes(parts[1])) return global.i18n.send('TAG_NAME_BLACKLISTED', msg.channel)
        if (parts[1].length < 1) return global.i18n.send('TAG_TOO_SHORT', msg.channel)
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
      case 'edit': {
        const tag = await driver.getTag(parts[1])
        if (!tag) {
          return global.i18n.send('TAG_NOT_FOUND', msg.channel, {
            tag: parts[1]
          })
        } else {
          if (tag.owner !== msg.author.id && !process.env.WILDBEAST_MASTERS.split('|').includes(msg.author.id)) {
            return global.i18n.send('TAG_NOT_OWNED', msg.channel)
          }
          const content = parts.slice(2).join(' ')
          if (!content || content.length < 0) {
            return global.i18n.send('TAG_TOO_SHORT', msg.channel)
          }
          await driver.edit(parts[1], {
            content: content
          }, 'tags')
          global.i18n.send('TAG_EDITED', msg.channel)
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
            tag: parts[1]
          })
        }
        if (tag.owner !== msg.author.id && !process.env.WILDBEAST_MASTERS.split('|').includes(msg.author.id)) {
          return global.i18n.send('TAG_NOT_OWNED', msg.channel)
        }
        await driver.delete('tags', parts.slice(1).join(' '))
        return global.i18n.send('TAG_DELETED', msg.channel, {
          tag: parts.slice(1).join(' ')
        })
      }
      default: {
        const tag = await driver.getTag(parts[0])
        if (!tag) {
          return global.i18n.send('TAG_NOT_FOUND', msg.channel, {
            tag: parts[0]
          })
        } else {
          msg.channel.createMessage(compiler(tag.content, {
            tagArgs: parts.slice(2),
            author: msg.author,
            channel: msg.channel,
            guild: msg.channel.guild,
            channels: msg.channel.guild ? msg.channel.guild.channels : [],
            members: msg.channel.guild ? msg.channel.guild.members : []
          }))
        }
        break
      }
    }
  }
}
