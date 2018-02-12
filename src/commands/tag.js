const driver = require('../internal/database-selector')
const TR = require('tag-replacer')
const compiler = new TR()
const blacklist = [ // eslint-disable-line
  'create',
  'raw',
  'owner',
  'delete'
]

module.exports = {
  meta: {
    level: 0,
    timeout: 10,
    alias: ['t'],
    help: 'Tags!'
  },
  fn: async (msg, suffix) => {
    const parts = suffix.split(' ')
    switch (parts[0]) {
      case 'create': {
        // TODO
        break
      }
      case 'raw': {
        // TODO
        break
      }
      case 'owner': {
        // TODO
        break
      }
      case 'delete': {
        await driver.delete('tags', suffix.slice(1).join(' '))
        return global.i18n.send('TAG_DELETED', msg.channel, {
          tag: suffix.slice(1).join(' ')
        })
      }
      default: {
        const tag = await driver.getTag(suffix)
        if (!tag) {
          return global.i18n.send('TAG_NOT_FOUND', msg.channel, {
            tag: suffix
          })
        } else {
          msg.channel.createMessage(compiler.replace(tag.content))
        }
        break
      }
    }
  }
}
