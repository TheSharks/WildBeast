const store = new Map()

module.exports = {
  /**
   * Create a message with pagination support
   * @param {String} user - The ID of the user that should be listened to
   * @param {module:eris.TextChannel} channel - The channel where the message should be sent
   * @param {Object[]} pages - Array of embed-compatible objects to act as pages for this pagination session
   * @param {String} text - Optional message to display above all embeds
   * @returns {Promise<Message>}
   */
  init: async (user, channel, pages, text) => {
    const msg = await channel.createMessage({
      content: text,
      embed: pages[0]
    })
    await msg.addReaction(String.fromCodePoint(0x23EA)) // rewind
    await msg.addReaction(String.fromCodePoint(0x2b05)) // arrow left
    await msg.addReaction(String.fromCodePoint(0x27A1)) // arrow right
    await msg.addReaction(String.fromCodePoint(0x23E9)) // fast-forward
    store.set(msg.id, { pages: pages, currentPage: 0, user: user })
    store.set(`timeout:${msg.id}`, setTimeout(() => stopPaginationSession(msg), 5000))
    return msg
  },
  _hook: async (msg, emoji, user) => {
    const client = require('./client')
    if (store.has(msg.id) && !emoji.id && msg.author.id === client.user.id) {
      const data = store.get(msg.id)
      if (user !== data.user) return
      switch (emoji.name.codePointAt(0)) {
        case 0x23EA : { // rewind
          await msg.edit({
            content: msg.content,
            embed: data.pages[0]
          })
          data.currentPage = 0
          break
        }
        case 0x2b05 : { // left
          if (!data.pages[data.currentPage - 1]) break
          await msg.edit({
            content: msg.content,
            embed: data.pages[data.currentPage - 1]
          })
          data.currentPage--
          break
        }
        case 0x27A1 : { // right
          if (!data.pages[data.currentPage + 1]) break
          await msg.edit({
            content: msg.content,
            embed: data.pages[data.currentPage + 1]
          })
          data.currentPage++
          break
        }
        case 0x23E9 : { // fast-forward
          await msg.edit({
            content: msg.content,
            embed: data.pages[data.pages.length - 1]
          })
          data.currentPage = data.pages.length - 1
          break
        }
      }
      clearTimeout(store.get(`timeout:${msg.id}`))
      store.set(`timeout:${msg.id}`, setTimeout(() => stopPaginationSession(msg), 5000))
      store.set(msg.id, data)
      if (msg.channel.guild && msg.channel.permissionsOf(client.user.id).has('manageMessages')) await client.removeMessageReaction(msg.channel.id, msg.id, emoji.name, user)
    }
  },
  _store: store
}

const stopPaginationSession = async (msg) => {
  if (msg.channel.guild && msg.channel.permissionsOf(msg.author.id).has('manageMessages')) await msg.removeReactions()
  // the author is guaranteed to be the client
  store.delete(msg.id)
  store.delete(`timeout:${msg.id}`)
}
