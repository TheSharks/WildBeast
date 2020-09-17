const Command = require('../../classes/Command')

module.exports = new Command(async function (msg, suffix) {
  const client = require('../../components/client')
  if (suffix.length === 0) return this.safeSendMessage(msg.channel, i18n.t('commands.ban.noMentions'))

  const chunks = suffix.split(' ')
  const ids = chunks
    .map(x => x.match(/([0-9]*)/)[1])
    .filter(x => x.length > 1 && x !== client.user.id)
  const members = [
    ...msg.mentions.filter(u => u.id !== client.user.id).map((user) => user.id),
    ...ids
  ]

  if (members.length === 0) return this.safeSendMessage(msg.channel, i18n.t('commands.ban.noResults'))

  const reason = chunks.slice(members.length).join(' ').length === 0
    ? '[No reason provided]'
    : chunks.slice(members.length).join(' ')

  const reply = await this.safeSendMessage(msg.channel, i18n.t('commands.common.working'))
  const result = await Promise.all(
    members
      .map(x => msg.channel.guild.banMember(x, 7, `${msg.author.username}#${msg.author.discriminator}: ${reason}`))
      // If a promise returns an error, add it to the results anyway and alert the user later
      .map(banReq => banReq.catch(e => e))
  )

  const succeeded = result.filter(x => !(x instanceof Error)).length
  const failed = result.filter(x => x instanceof Error).length
  await reply.edit(
    i18n.t('commands.ban.done', { num: succeeded }) +
    (failed > 0 ? '\n' + i18n.t('commands.ban.failed', { num: failed }) : '')
  )
}, {
  clientPerms: {
    guild: ['banMembers']
  },
  userPerms: {
    guild: ['banMembers']
  },
  disableDM: true
})
