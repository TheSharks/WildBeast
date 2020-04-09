const { guildMessages } = require('../../components/analytics')

module.exports = (msg) => {
  guildMessages.labels(msg.channel.guild ? msg.channel.guild.id : msg.channel.id).inc()
}
