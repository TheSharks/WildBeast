require('dotenv').config({path: '../../.env'})

module.exports = {
  meta: {
    level: 0,
    timeout: 5,
    alias: ['botinfo'],
    help: 'I\'ll respond with info about me!'
  },
  fn: (msg) => {
    let bot = global.bot
    let owner
    if (process.env.WILDBEAST_MASTERS) {
      let userObj = bot.users.get(process.env.WILDBEAST_MASTERS.split('|')[0])
      owner = `${userObj.username}#${userObj.discriminator}`
    } else {
      owner = 'Dougley#6666'
    }
    let fields = [{name: 'Servers Connected', value: '```\n' + bot.guilds.size + '```', inline: true},
      {name: 'Users Known', value: '```\n' + bot.users.size + '```', inline: true},
      {name: 'Channels Connected', value: '```\n' + Object.keys(bot.channelGuildMap).length + '```', inline: true},
      {name: 'Private Channels', value: '```\n' + Object.keys(bot.privateChannelMap).length + '```', inline: true},
      {name: 'Owner', value: '```\n' + owner + '```', inline: true},
      {name: 'Shard ID', value: '```\n' + `${msg.channel.guild.shard.id}` + '```', inline: true}]
    msg.channel.createMessage({embed: {
      color: 0x3498db,
      author: {icon_url: bot.user.avatarURL, name: `${bot.user.username}#${bot.user.discriminator} (${bot.user.id})`},
      title: `Running on WildBeast version ${require('../../package.json').version}`,
      timestamp: new Date(),
      fields: fields,
      url: 'https://github.com/TheSharks/WildBeast',
      footer: {text: `Online since ${new Date(Date.now() - bot.uptime).toString()} (${(bot.uptime / 1000 / 60).toFixed(2)} minutes)`}
    }})
  }
}
