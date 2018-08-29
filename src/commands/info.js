module.exports = {
  meta: {
    help: 'Get information about this bot.',
    module: 'Util',
    level: 0,
    timeout: 5,
    alias: ['botinfo']
  },
  fn: async (msg) => {
    let bot = global.bot
    let user = await bot.getRESTUser('107904023901777920')
    let owner = `${user.username}#${user.discriminator}`
    let fields = [{name: 'Servers Connected', value: '```\n' + bot.guilds.size + '```', inline: true},
      {name: 'Users Known', value: '```\n' + bot.users.size + '```', inline: true},
      {name: 'Channels Connected', value: '```\n' + Object.keys(bot.channelGuildMap).length + '```', inline: true},
      {name: 'Private Channels', value: '```\n' + Object.keys(bot.privateChannelMap).length + '```', inline: true},
      {name: 'Owner', value: '```\n' + owner + '```', inline: true}
    ]
    if (msg.channel.guild) fields.push({name: 'Shard ID', value: '```\n' + `${msg.channel.guild.shard.id}` + '```', inline: true})
    msg.channel.createMessage({embed: {
      color: 0x3498db,
      author: {icon_url: bot.user.avatarURL, name: `${bot.user.username}#${bot.user.discriminator} (${bot.user.id})`},
      title: `Running on WildBeast version ${require('../../package.json').version}`,
      timestamp: new Date(),
      fields: fields,
      url: 'https://github.com/TheSharks/WildBeast',
      footer: {text: `Started ${require('moment')(Date.now() - (Math.floor(process.uptime()) * 1000)).fromNow()}`}
    }})
  }
}
