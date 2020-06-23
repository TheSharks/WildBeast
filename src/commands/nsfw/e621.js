const Command = require('../../classes/Command')

module.exports = new Command((msg, suffix) => {
  const booru = require('./booru')
  return booru.run(msg, `e621 ${suffix}`)
}, {
  nsfw: true,
  clientPerms: {
    channel: ['embedLinks']
  },
  aliases: ['e6']
})
