const Command = require('../../classes/Command')
const client = require('../../components/client')

module.exports = new Command(async (msg, suffix) => {
  const player = client.wildbeastVoiceConnections.get(msg.channel.guild.id)
  if (player) {
    await player.resolveAndAdd(suffix)
  }
}, {

})
