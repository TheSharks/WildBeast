const Command = require('../../classes/Command')

module.exports = new Command(async function (msg, suffix) {
  const client = require('../../components/client')
  if (suffix.length === 0) return this.safeSendMessage(msg.channel, 'Please provide IDs or mention users you\'d like to kick')

  const chunks = suffix.split(' ')
  const ids = chunks
    .map(x => x.match(/([0-9]*)/)[1])
    .filter(x => x.length > 1 && x !== client.user.id)
  const members = [
    ...msg.mentions.filter(u => u.id !== client.user.id).map((user) => msg.channel.guild.members.get(user.id)),
    ...ids.map((user) => msg.channel.guild.members.get(user))
  ].filter(x => x !== undefined)

  if (members.length === 0) return this.safeSendMessage(msg.channel, 'Couldn\'t find those users in the server')

  const reason = chunks.slice(members.length).join(' ').length === 0
    ? '[No reason provided]'
    : chunks.slice(members.length).join(' ')

  const reply = await this.safeSendMessage(msg.channel, 'Working on it...')
  const result = await Promise.all(
    members
      .map(x => x.kick(`${msg.author.username}#${msg.author.discriminator}: ${reason}`))
      .map(p => p.catch(e => e))
  )

  const succeeded = result.filter(x => !(x instanceof Error)).length
  const failed = result.filter(x => x instanceof Error).length
  await reply.edit(
    `Kicked ${succeeded} members` +
    (failed > 0 ? `\nFailed to kick ${failed} members` : '')
  )
}, {
  clientPerms: {
    guild: ['kickMembers']
  },
  userPerms: {
    guild: ['kickMembers']
  },
  disableDM: true
})
