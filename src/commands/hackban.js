module.exports = {
  meta: {
    help: 'Ban a user by ID.',
    usage: '<userid> [reason]',
    module: 'Admin',
    level: 0,
    noDM: true,
    alias: ['banbyid', 'idban'],
    permAddons: ['Ban Members']
  },
  fn: function (msg, suffix) {
    let bot = global.bot
    if (!msg.member.permission.json.banMembers) {
      msg.channel.createMessage(`<@${msg.author.id}>, Sorry but you do not have permission to ban members.`)
    } else if (!msg.channel.guild.members.get(bot.user.id).permission.json.banMembers) {
      msg.channel.createMessage(`<@${msg.author.id}>, Sorry but I do not have the required permission to ban members.`)
    } else if (!suffix) {
      msg.channel.createMessage('You need to provide an ID to ban!')
    } else if (msg.mentions.filter(m => m.id !== bot.user.id).length > 0) {
      msg.channel.createMessage('You need to provide an ID to ban! Mentions aren\'t supported for hackban.')
    } else {
      msg.channel.createMessage(`<@${msg.author.id}>, Please wait...`).then((m) => {
        let banMembers = { success: [], error: [] }
        let idArray = []
        let reasonWords = []
        suffix.split(' ').map((id) => {
          if (isNaN(id) || id.length < 16) {
            reasonWords.push(id)
          } else {
            idArray.push(id)
          }
        })
        let reason = reasonWords.length > 0 ? reasonWords.join(' ') : 'No reason provided.'
        idArray.map((id) => {
          bot.getRESTUser(id).then((user) => {
            msg.channel.guild.banMember(id, 0, `${msg.author.username}#${msg.author.discriminator} used hackban for: ${reason}`).then(() => {
              banMembers.success.push(`\`${user.username}#${user.discriminator}\``)
              if (banMembers.success.length + banMembers.error.length === idArray.length) {
                let resp = ''
                if (banMembers.success.length !== 0) resp += `Hackbanned the following: ${banMembers.success.join(', ')}\n`
                if (banMembers.error.length !== 0) resp += `Could not hackban the following: ${banMembers.error.join(', ')}\n`
                resp += `Reason provided by user: ${reason}`
                m.edit(resp)
              }
            }).catch(() => {
              banMembers.error.push(`\`${user.username}#${user.discriminator}\``)
              if (banMembers.success.length + banMembers.error.length === idArray.length) {
                let resp = ''
                if (banMembers.success.length !== 0) resp += `Hackbanned the following: ${banMembers.success.join(', ')}\n`
                if (banMembers.error.length !== 0) resp += `Could not hackban the following: ${banMembers.error.join(', ')}\n`
                resp += `Reason provided by user: ${reason}`
                m.edit(resp)
              }
            })
          })
        })
      })
    }
  }
}
