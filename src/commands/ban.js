module.exports = {
  meta: {
    help: 'Ban a user.',
    usage: '@user [reason]',
    module: 'Admin',
    level: 0,
    noDM: true
  },
  fn: function (msg, suffix) {
    const bot = global.bot
    function safeLoop (msg, days, members, reason, list) {
      if (members.length === 0) {
        let resp = ``
        if (list.success.length !== 0) resp += `Banned the following for **${days}** days: ${list.success.join(', ')}\n`
        if (list.error.length !== 0) resp += `Could not ban the following: ${list.error.join(', ')}\n`
        resp += `Reason provided by user: ${reason}`
        msg.channel.createMessage(`<@${msg.author.id}>, ${resp}`)
      } else {
        members[0].ban(parseInt(days), `${msg.author.username}#${msg.author.discriminator} used ban for: ${reason}`).then(() => {
          list.success.push(`\`${members[0].username}\``)
          members.shift()
          safeLoop(msg, days, members, reason, list)
        }).catch(() => {
          list.error.push(`\`${members[0].username}\``)
          members.shift()
          safeLoop(msg, days, members, reason, list)
        })
      }
    }

    if (!msg.member.permission.json.banMembers) {
      msg.channel.createMessage(`<@${msg.author.id}>, Sorry but you do not have permission to ban members.`)
    } else if (!msg.channel.guild.members.get(bot.user.id).permission.json.banMembers) {
      msg.channel.createMessage(`<@${msg.author.id}>, Sorry but I do not have the required permission to ban members.`)
    } else if (msg.mentions.filter(m => m.id !== bot.user.id).length === 0) {
      msg.channel.createMessage('Please mention the user(s) you want to ban.')
    } else {
      let chunks = suffix.split(' ')
      let days = isNaN(parseInt(chunks[0], 10)) ? 1 : parseInt(chunks[0], 10)
      if ([0, 1, 7].includes(days)) {
        const members = msg.mentions.filter(u => u.id !== bot.user.id).map((user) => msg.channel.guild.members.find(m => m.id === user.id))
        const reason = isNaN(chunks[0]) ? chunks.slice(members.length).join(' ').length === 0 ? 'No reason provided.' : chunks.slice(members.length).join(' ') : chunks.slice(members.length + 1).join(' ').length === 0 ? 'No reason provided.' : chunks.slice(members.length + 1).join(' ')
        let list = {success: [], error: []}

        safeLoop(msg, days, members, reason, list)
      } else {
        msg.channel.createMessage(`<@${msg.author.id}>, Your first argument must be a number or nothing for the default of 1, can only be 0, 1 or 7!`)
      }
    }
  }
}
