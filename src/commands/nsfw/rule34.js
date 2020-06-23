const Command = require('../../classes/Command')

module.exports = new Command((msg, suffix) => {
  const booru = require('./booru')
  return booru.run(msg, `rule34 ${suffix}`)
}, {
  nsfw: true,
  clientPerms: {
    channel: ['embedLinks']
  },
  aliases: ['r34']
})
