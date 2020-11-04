const Command = require('../../classes/Command')

module.exports = new Command(async function (msg, suffix) {
  const SA = require('superagent')
  try {
    if (!suffix) return this.safeSendMessage(msg.channel, i18n.t('commands.urbandictionary.errors.noTerm'))
    const res = await SA.get('http://api.urbandictionary.com/v0/define')
      .query({ term: suffix })
    if (res.body.list.length < 1) return this.safeSendMessage(msg.channel, i18n.t('commands.urbandictionary.errors.notFound'))
    const ctx = res.body.list[0]
    await this.safeSendMessage(msg.channel, {
      embed: {
        color: 0x6832e3,
        author: {
          name: 'Urban Dictionary'
        },
        title: ctx.word,
        url: ctx.permalink,
        description: ctx.definition.length > 2000 ? ctx.definition.substring(0, 2000) + '[...]' : ctx.definition,
        fields: [
          {
            name: i18n.t('commands.urbandictionary.example'),
            value: ctx.example ? (ctx.example.length > 1000 ? ctx.example.substring(0, 1000) + '[...]' : ctx.example) : i18n.t('commands.urbandictionary.noExample')
          }
        ]
      }
    })
  } catch (e) {
    this.safeSendMessage(msg.channel, i18n.t('commands.common.softFail'))
    logger.error('CMD', e)
  }
}, {
  clientPerms: {
    channel: ['embedLinks']
  },
  aliases: ['ud'],
  nsfw: true
})
