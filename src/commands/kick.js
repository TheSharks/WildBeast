module.exports = {
  meta: {
    help: 'Kick a user.',
    usage: '@user [reason]',
    module: 'Admin',
    level: 0,
    noDM: true,
    alias: ['boot']
  },
  fn: function (msg, suffix) {
    let bot = global.bot
    if (!msg.member.permission.json.kickMembers) {
      msg.channel.createMessage(`<@${msg.author.id}>, Sorry but you do not have permission to kick members.`)
    } else if (!msg.channel.guild.members.get(bot.user.id).permission.json.kickMembers) {
      msg.channel.createMessage(`<@${msg.author.id}>, Sorry but I do not have the required permission to kick members.`)
    } else if (msg.mentions.filter(m => m.id !== bot.user.id).length === 0) {
      msg.channel.createMessage('Please mention the user(s) you want to kick.')
    } else {
      let chunks = suffix.split(' ')
      let members = msg.mentions.filter(u => u.id !== bot.user.id).map((user) => msg.channel.guild.members.get(user.id))
      let reason = chunks.slice(members.length).join(' ').length === 0 ? 'No reason provided.' : chunks.slice(members.length).join(' ')
      let list = {success: [], error: []}
      safeLoop(msg, members, reason, list)
    }

    function safeLoop (msg, members, reason, list) {
      if (members.length === 0) {
        let resp = ''
        if (list.success.length !== 0) resp += `Kicked the following: ${list.success.join(', ')}\n`
        if (list.error.length !== 0) resp += `Could not kick the following: ${list.error.join(', ')}\n`
        resp += `Reason provided by user: ${reason}`
        msg.channel.createMessage(`<@${msg.author.id}>, ${resp}`)
      } else {
        members[0].kick(`${msg.author.username}#${msg.author.discriminator} used kick for: ${reason}`).then(() => {
          list.success.push(`\`${members[0].username}\``)
          members.shift()
          safeLoop(msg, members, reason, list)
        }).catch(() => {
          list.error.push(`\`${members[0].username}\``)
          members.shift()
          safeLoop(msg, members, reason, list)
        })
      }
    }
  }
}
