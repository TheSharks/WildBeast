const sites = {
  gelbooru: {
    apiStyle: 'gelbooru',
    baseURL: 'https://gelbooru.com/index.php',
    cdn: (ctx) => ctx.file_url
  },
  derpibooru: {
    apiStyle: 'rails-booru',
    baseURL: 'https://derpibooru.org/search.json'
  },
  rule34: {
    apiStyle: 'gelbooru',
    baseURL: 'https://rule34.xxx/index.php',
    cdn: (ctx) => `https://img.rule34.xxx/images/${ctx.directory}/${ctx.image}`
  },
  e621: {
    apiStyle: 'e621',
    baseURL: 'https://e621.net/posts.json'
  }
}

const Command = require('../../classes/Command')

module.exports = new Command(async function (msg, suffix) {
  const SA = require('superagent')

  const parts = suffix.split(' ')
  if (parts.length < 2) return this.safeSendMessage(msg.channel, i18n.t('commands.booru.badFormatting'))
  if (!sites[parts[0]]) return this.safeSendMessage(msg.channel, i18n.t('commands.booru.siteNotSupported', { site: parts[0], supported: Object.keys(sites).join(', ') }))
  const query = parts.slice(1).join(' ')
  msg.channel.sendTyping()
  switch (sites[parts[0]].apiStyle) {
    case 'gelbooru': {
      const resp = await SA(sites[parts[0]].baseURL)
        .query({
          page: 'dapi',
          s: 'post',
          q: 'index',
          tags: query,
          json: 1
        })
        .set({
          'User-Agent': `github.com/TheSharks/WildBeast@${require('../../../package.json').version}`,
          Accept: 'application/json'
        })
      try {
        resp.body = JSON.parse(resp.text)
      } catch (e) {
        if (resp.body.length === 0) return this.safeSendMessage(msg.channel, i18n.t('commands.booru.noResults', { query })) // quality api
        else return this.safeSendMessage(msg.channel, i18n.t('commands.common.softFail'))
      }
      const post = resp.body[Math.floor((Math.random() * resp.body.length))]
      return this.safeSendMessage(msg.channel, generateEmbed(sites[parts[0]].cdn(post)))
    }
    case 'rails-booru': {
      SA(sites[parts[0]].baseURL)
        .query({ q: parts.slice(1).join('+') })
        .set({ 'User-Agent': `github.com/TheSharks/WildBeast@${require('../../../package.json').version}` })
        .then(res => {
          if (!res.body.search || res.body.search.length < 1) {
            return this.safeSendMessage(msg.channel, i18n.t('commands.booru.noResults', { query }))
          }
          const count = Math.floor((Math.random() * res.body.search.length))
          return this.safeSendMessage(msg.channel, generateEmbed(`https:${res.body.search[count].representations.tall}`)) // why
        })
      break
    }
    case 'e621': {
      // wow look at e621 being all special with their own api style
      SA(sites[parts[0]].baseURL)
        .query({ limit: '50', tags: query })
        .set({
          Accept: 'application/json',
          'User-Agent': `github.com/TheSharks/WildBeast@${require('../../../package.json').version} (by @Dougley)`
        })
        .then(res => {
          if (res.body.posts.length < 1) {
            return this.safeSendMessage(msg.channel, i18n.t('commands.booru.noResults', { query }))
          }
          const post = res.body.posts[Math.floor((Math.random() * res.body.posts.length))]
          return this.safeSendMessage(msg.channel, generateEmbed(post.file.url))
        }).catch(e => {
          if (e.status) { // is this error thrown by the e621 server or by the module?
            if (e.response.body.reason) this.safeSendMessage(msg.channel, e.response.body.reason)
          } else throw e
        })
    }
  }
}, {
  nsfw: true,
  clientPerms: {
    channel: ['embedLinks']
  }
})

const generateEmbed = (url) => {
  return {
    embed: {
      image: {
        url: url
      },
      color: 0xaae5a3
    }
  }
}
