const SA = require('superagent')

const sites = {
  gelbooru: {
    apiStyle: 'gelbooru',
    baseURL: 'https://gelbooru.com/index.php'
  },
  derpibooru: {
    apiStyle: 'rails-booru',
    baseURL: 'https://derpibooru.org/search.json'
  },
  rule34: {
    apiStyle: 'gelbooru',
    baseURL: 'https://rule34.xxx/index.php'
  },
  e621: {
    apiStyle: 'e621',
    baseURL: 'https://e621.net/posts.json'
  }
}

module.exports = {
  meta: {
    help: 'Query various booru sites for images.',
    usage: '<gelbooru/rule34/e621> <search query>',
    module: 'Porn',
    level: 0,
    timeout: 1, // somewhat of an external ratelimit compliance
    nsfw: true,
    addons: [
      `Available sites: ${Object.keys(sites).join(', ')}`
    ]
  },
  fn: function (msg, suffix) {
    const parts = suffix.split(' ')
    const query = parts.slice(1).join(' ')
    if (parts[0].length < 2) return global.i18n.send('INVALID_COMMAND_SYNTAX', msg.channel)
    if (!sites[parts[0]]) {
      return global.i18n.send('BOORU_SITE_UNKNOWN', msg.channel, {
        site: parts[0]
      })
    }
    msg.channel.sendTyping()
    switch (sites[parts[0]].apiStyle) {
      case 'gelbooru': { // Gelbooru interpretation has xml conversion to provide full support, although we do prefer JSON
        SA(sites[parts[0]].baseURL)
          .query({ page: 'dapi', s: 'post', q: 'index', tags: query })
          .set({ 'User-Agent': 'Superagent Node.js' })
          .then(res => {
            const result = require('xml-js').xml2js(res.text, { compact: true })
            if (!result.posts.post || result.posts.post.length < 1) {
              return global.i18n.send('BOORU_NO_RESULTS', msg.channel, {
                query: (query.length > 0) ? query : 'random'
              })
            }
            const count = Math.floor((Math.random() * result.posts.post.length))
            global.i18n.send('BOORU_SUCCESS', msg.channel, {
              query: (query.length > 0) ? query : 'random',
              url: result.posts._attributes.count > 1 ? result.posts.post[count]._attributes.file_url : result.posts.post._attributes.file_url
            })
          })
        break
      }
      case 'rails-booru': {
        SA(sites[parts[0]].baseURL)
          .query({ q: parts.slice(1).join('+') })
          .set({ 'User-Agent': 'Superagent Node.js' })
          .then(res => {
            if (!res.body.search || res.body.search.length < 1) {
              return global.i18n.send('BOORU_NO_RESULTS', msg.channel, {
                query: (query.length > 0) ? query : 'random'
              })
            }
            const count = Math.floor((Math.random() * res.body.search.length))
            global.i18n.send('BOORU_SUCCESS', msg.channel, {
              query: (query.length > 0) ? query : 'random',
              url: `https:${res.body.search[count].representations.tall}` // why
            })
          })
        break
      }
      case 'e621': {
        // wow look at e621 being all special with their own api style
        SA(sites[parts[0]].baseURL)
          .query({ limit: '50', tags: parts.slice(1).join(' ') })
          .set({ Accept: 'application/json', 'User-Agent': 'github.com/TheSharks/WildBeast@6.0.0 (by @Dougley)' })
          .then(res => {
            if (res.body.posts.length < 1) {
              return global.i18n.send('BOORU_NO_RESULTS', msg.channel, {
                query: (query.length > 0) ? query : 'random'
              })
            }
            const count = Math.floor((Math.random() * res.body.posts.length))
            global.i18n.send('BOORU_SUCCESS', msg.channel, {
              query: (query.length > 0) ? query : 'random',
              url: res.body.posts[count].file.url
            })
          }).catch(e => {
            if (e.status) { // is this error thrown by the e621 server or by the module?
              if (e.response.body.reason) msg.channel.createMessage(e.response.body.reason) // TODO: use i18n
            } else throw e
          })
        break
      }
    }
  }
}
