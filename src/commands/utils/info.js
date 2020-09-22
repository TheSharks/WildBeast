const Command = require('../../classes/Command')

module.exports = new Command(function (msg) {
  const client = require('../../components/client')
  const { formatDistanceToNowStrict, sub, formatISO9075 } = require('date-fns')
  const uptime = sub(new Date(), { seconds: process.uptime() })
  const normalizedUptime = formatDistanceToNowStrict(uptime, {
    includeSeconds: true
  })
  const ISOUptime = formatISO9075(uptime)
  return this.safeSendMessage(msg.channel, {
    embed: {
      fields: [
        {
          name: i18n.t('commands.info.guilds'),
          value: client.guilds.size,
          inline: true
        },
        {
          name: i18n.t('commands.info.uptime'),
          value: `${normalizedUptime} (${ISOUptime})`,
          inline: true
        },
        {
          name: i18n.t('commands.info.shard'),
          value: `${client.options.firstShardID}/${client.options.maxShards}`,
          inline: true
        }
      ]
    }
  })
}, {
  aliases: ['stats']
})
