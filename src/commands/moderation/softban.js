const Command = require('../../classes/Command')

module.exports = new Command(async function (msg, suffix) {
  const client = require('../../components/client')
  if (suffix.length === 0) return this.safeSendMessage(msg.channel, i18n.t('commands.softban.noMentions'))

  const chunks = suffix.split(' ')
  const ids = chunks
    .map(x => x.match(/([0-9]*)/)[1])
    .filter(x => x.length > 1 && x !== client.user.id)
  const members = [
    ...msg.mentions.filter(u => u.id !== client.user.id).map((user) => msg.channel.guild.members.get(user.id)),
    ...ids.map((user) => msg.channel.guild.members.get(user))
  ].filter(x => x !== undefined)

  if (members.length === 0) return this.safeSendMessage(msg.channel, i18n.t('commands.ban.noResults'))

  const reason = chunks.slice(members.length).join(' ').length === 0
    ? '[No reason provided]'
    : chunks.slice(members.length).join(' ')

  const reply = await this.safeSendMessage(msg.channel, i18n.t('commands.common.working'))
  const result = await Promise.all(
    members
      .map(x => x.ban(7, `${msg.author.username}#${msg.author.discriminator}: ${reason}`))
      .map(p => p.catch(e => e))
  )
  await Promise.all(
    members
      .map(x => x.unban(`${msg.author.username}#${msg.author.discriminator}: ${reason}`))
      .map(p => p.catch(e => e))
  )

  const succeeded = result.filter(x => !(x instanceof Error)).length
  const failed = result.filter(x => x instanceof Error).length
  await reply.edit(
    i18n.t('commands.softban.done', { num: succeeded }) +
    (failed > 0 ? '\n' + i18n.t('commands.softban.failed', { num: failed }) : '')
  )
}, {
  clientPerms: {
    guild: ['banMembers']
  },
  userPerms: {
    guild: ['kickMembers']
  },
  disableDM: true
})
