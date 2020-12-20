const Command = require('../../classes/Command')
const { timestamp } = require('detritus-client').Utils.Snowflake

module.exports = new Command(function (msg) {
  const start = new Date(timestamp(msg.id))
  this.interactions.callback(msg, 'Pong!').then(() => {
    this.interactions.editCallback(msg, `Pong! \`${Math.floor(Date.now() - start)}ms\``)
  })
})
