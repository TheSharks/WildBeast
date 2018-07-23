const SA = require('superagent')

module.exports = {
  meta: {
    help: 'Create memes and other reaction images.',
    module: 'Fun',
    timeout: 5,
    addons: [
      `Use \`${process.env.BOT_PREFIX}meme templates\` to get all available templates`
    ],
    level: 0
  },
  fn: async (msg, suffix) => {
    if (suffix.toLowerCase() === 'templates') {
      const data = await SA.get('https://memegen.link/api/templates/')
      const names = Object.entries(data.body).map(x => /https:\/\/memegen\.link\/api\/templates\/(.+)/.exec(x)[1])
      msg.channel.createMessage('Sending you all available meme templates via DM')
      const ctx = await msg.author.getDMChannel()
      ctx.createMessage(`Available meme templates:\n\n${names.join(', ')}`)
    } else {
      const tags = suffix.split('"')
      const memetype = tags[0].split(' ')[0]
      const keywords = tags.slice(1).filter(x => x.trim().length > 0)
      if (!memetype || keywords.length === 0) {
        return global.i18n.send('PERMISSIONS_MALFORMED', msg.channel)
      } else {
        return msg.channel.createMessage(`http://memegen.link/${memetype}/${translate(keywords[0])}/${translate(keywords[1])}.jpg`)
      }
    }
  }
}

function translate (string) {
  const map = {
    ' ': '_',
    '-': '--',
    '%': '~p',
    '#': '~h',
    '/': '~s',
    '"': "''"
  }
  for (const y in map) {
    string = string.replace(new RegExp(y, 'g'), map[y])
  }
  string = string.replace(/\?/g, '~q')
  return string
}
