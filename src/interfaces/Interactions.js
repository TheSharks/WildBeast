module.exports = {
  callback: async (ctx, msg) => {
    const client = require('../components/client')
    return client.rest.request({
      method: 'POST',
      url: `https://discord.com/api/v8/interactions/${ctx.id}/${ctx.token}/callback`,
      body: {
        type: 4,
        data: {
          ...((typeof msg === 'string') ? { content: msg } : msg),
          allowedMentions: {
            roles: [],
            users: []
          }
        }
      }
    })
  },
  editCallback: (ctx, msg) => {
    const client = require('../components/client')
    return client.rest.request({
      method: 'PATCH',
      url: `https://discord.com/api/v8/webhooks/${client.application.id}/${ctx.token}/messages/@original`,
      body: {
        ...((typeof msg === 'string') ? { content: msg } : msg),
        allowedMentions: {
          roles: [],
          users: []
        }
      }
    })
  },
  deleteCallback: async (ctx) => {
    const client = require('../components/client')
    return client.rest.request({
      method: 'DELETE',
      url: `https://discord.com/api/v8/webhooks/${client.application.id}/${ctx.token}/messages/@original`
    })
  },
  createMessage: async (ctx, msg) => {
    const client = require('../components/client')
    return client.rest.request({
      method: 'POST',
      url: `https://discord.com/api/v8/webhooks/${client.application.id}/${ctx.token}/messages`,
      body: {
        ...((typeof msg === 'string') ? { content: msg } : msg),
        allowedMentions: {
          roles: [],
          users: []
        }
      }
    })
  },
  deleteMessage: async (ctx, msg) => {
    const client = require('../components/client')
    return client.rest.request({
      method: 'DELETE',
      url: `https://discord.com/api/v8/webhooks/${client.application.id}/${ctx.token}/messages/${msg.id}`
    })
  },
  editMessage: async (id, ctx, msg) => {
    const client = require('../components/client')
    return client.rest.request({
      method: 'POST',
      url: `https://discord.com/api/v8/webhooks/${client.application.id}/${ctx.token}/messages/${id}`,
      body: {
        ...((typeof msg === 'string') ? { content: msg } : msg),
        allowedMentions: {
          roles: [],
          users: []
        }
      }
    })
  }
}
