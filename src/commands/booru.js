const SA = require('superagent')

const sites = {
  gelbooru: {
    apiStyle: 'gelbooru',
    baseURL: 'https://gelbooru.com/index.php'
  },
  rule34: {
    apiStyle: 'gelbooru',
    baseURL: 'https://rule34.xxx/index.php'
  },
  e621: {
    apiStyle: 'e621',
    baseURL: 'https://e621.net/post/index.json'
  }
}

module.exports = {
  meta: {
    help: 'Query various booru sites for images.',
    nsfw: true,
    timeout: 1, // somewhat of an external ratelimit compliance
    level: 0,
    module: 'Porn',
    addons: [
      `Available sites: ${Object.keys(sites).join(', ')}`
    ]
  },
  fn: function (msg, suffix) {
    const parts = suffix.split(' ')
    const query = parts.slice(1).join(' ')
    if (!sites[parts[0]]) {
      return global.i18n.send('BOORU_SITE_UNKNOWN', msg.channel, {
        site: parts[0]
      })
    }
    msg.channel.sendTyping()
    switch (sites[parts[0]].apiStyle) {
      case 'gelbooru': { // Gelbooru interpretation has xml conversion to provide full support, although we do prefer JSON
        SA(sites[parts[0]].baseURL)
          .query({page: 'dapi', s: 'post', q: 'index', tags: query})
          .set({'User-Agent': 'Superagent Node.js'})
          .then(res => {
            const result = require('xml-js').xml2js(res.text, {compact: true})
            if (!result.posts.post || result.posts.post.length < 1) {
              return global.i18n.send('BOORU_NO_RESULTS', msg.channel, {
                query: (query.length > 0) ? query : 'random'
              })
            }
            const count = Math.floor((Math.random() * result.posts.post.length))
            global.i18n.send('BOORU_SUCCESS', msg.channel, {
              query: (query.length > 0) ? query : 'random',
              url: result.posts.post[count]._attributes.file_url
            })
          })
        break
      }
      case 'e621': {
        // wow look at e621 being all special with their own api style
        SA(sites[parts[0]].baseURL)
          .query({limit: '50', tags: parts.slice(1).join(' ')})
          .set({'Accept': 'application/json', 'User-Agent': 'Superagent Node.js'})
          .then(res => {
            if (res.body.length < 1) {
              return global.i18n.send('BOORU_NO_RESULTS', msg.channel, {
                query: (query.length > 0) ? query : 'random'
              })
            }
            const count = Math.floor((Math.random() * res.body.length))
            global.i18n.send('BOORU_SUCCESS', msg.channel, {
              query: (query.length > 0) ? query : 'random',
              url: res.body[count].file_url
            })
          })
        break
      }
    }
  }
}
