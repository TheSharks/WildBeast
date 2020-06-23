const Command = require('../../classes/Command')

module.exports = new Command(async msg => {
  const client = require('../../components/client')
  const player = client.voiceConnectionManager.get(msg.channel.guild.id)
  if (!player) return msg.channel.createMessage("I'm not streaming in this server")
  return msg.channel.createMessage(createEmbed(player.playlist))
}, {
  clientPerms: {
    channel: ['embedLinks']
  },
  disableDM: true
})

const createEmbed = (ctx) => {
  return {
    embed: {
      title: 'Current playlist',
      description:
        (ctx.length > 0)
          ? `There are ${ctx.length} songs queued${ctx.length > 10 ? ', showing the next 10' : ''}`
          : `Currently nothing is queued, queue something with \`${process.env.BOT_PREFIX}play\`!`,
      fields: ctx.slice(0, 10).map(x => {
        return {
          name: ctx.indexOf(x) + 1,
          value: `${x.info.title} - ${x.info.author}`
        }
      })
    }
  }
}
