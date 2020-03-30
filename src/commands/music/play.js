const Command = require('../../classes/Command')
const client = require('../../components/client')

module.exports = new Command(async (msg, suffix) => {
  const player = client.voiceConnections.get(msg.channel.guild.id)
  if (player) {
    const data = await player.node.loadTracks(suffix)
    player.play(data.tracks[0].track)
  }
}, {

})
