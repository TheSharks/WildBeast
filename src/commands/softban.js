module.exports = {
  meta: {
    level: 0,
    alias: ['messageban'],
    help: 'I\'ll ban and unban someone you give me the id of, or mention, removing their messages in the process. softban 12345678 reason | softban @user reason',
    noDM: true
  },
  fn: function (msg, suffix) {
    const bot = global.bot
    if (!msg.member.permission.json.banMembers) {
      msg.channel.createMessage(`<@${msg.author.id}>, Sorry but you do not have permission to ban members.`)
    } else if (!msg.channel.guild.members.get(bot.user.id).permission.json.banMembers) {
      msg.channel.createMessage(`<@${msg.author.id}>, Sorry but I do not have the required permission to ban members.`)
    } else if (!suffix) {
      msg.channel.createMessage('You need to provide an ID to ban!')
    } else if (msg.mentions.filter(m => m.id !== bot.user.id).length > 0) {
      msg.channel.createMessage('Please wait...').then((m) => {
        const membersToBan = msg.mentions.filter(m => m.id !== bot.user.id)
        const banMembers = {success: [], error: []}
        let reasonWords = []
        suffix.split(' ').map((id) => {
          if (id.startsWith('<@')) {
          } else {
            reasonWords.push(id)
          }
        })
        const reason = reasonWords.length > 0 ? reasonWords.join(' ') : 'No reason provided.'
        membersToBan.map((user) => {
          msg.channel.guild.banMember(user.id, 1, `${msg.author.username}#${msg.author.discriminator} used softban for: ${reason}`).then(() => {
            msg.channel.guild.unbanMember(user.id, 'Automatic unban from softban.').then(() => {
              banMembers.success.push(`\`${user.username}#${user.discriminator}\``)
              if (banMembers.success.length + banMembers.error.length === membersToBan.length) {
                let resp = ''
                if (banMembers.success.length !== 0) resp += `Softbanned the following: ${banMembers.success.join(', ')}\n`
                if (banMembers.error.length !== 0) resp += `Could not softban the following: ${banMembers.error.join(', ')}\n`
                resp += `Reason provided by user: ${reason}`
                m.edit(resp)
              }
            }).catch(() => {
              banMembers.error.push(`\`${user.username}#${user.discriminator}\``)
              if (membersToBan.length === banMembers.error.length) {
                let resp = ''
                if (banMembers.success.length !== 0) resp += `Softbanned the following: ${banMembers.success.join(', ')}\n`
                if (banMembers.error.length !== 0) resp += `Could not softban the following: ${banMembers.error.join(', ')}\n`
                resp += `Reason provided by user: ${reason}`
                m.edit(resp)
              }
            })
          }).catch(() => {
            banMembers.error.push(`\`${user.username}#${user.discriminator}\``)
            if (membersToBan.length === banMembers.error.length) {
              let resp = ''
              if (banMembers.success.length !== 0) resp += `Softbanned the following: ${banMembers.success.join(', ')}\n`
              if (banMembers.error.length !== 0) resp += `Could not softban the following: ${banMembers.error.join(', ')}\n`
              resp += `Reason provided by user: ${reason}`
              m.edit(resp)
            }
          })
        })
      })
    } else {
      msg.channel.createMessage(`<@${msg.author.id}>, Please wait...`).then((m) => {
        let banMembers = {success: [], error: []}
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
          let member = msg.channel.guild.members.get(id)
          if (!member) {
            m.edit('A provided ID isn\'t a member of this guild!')
            return
          }
          msg.channel.guild.banMember(id, 1, `${msg.author.username}#${msg.author.discriminator} used softban for: ${reason}`).then(() => {
            member.unbanMember(id, 'Automatic unban from softban').then(() => {
              banMembers.success.push(`\`${member.username}#${member.discriminator}\``)
              if (banMembers.success.length + banMembers.error.length === idArray.length) {
                let resp = ''
                if (banMembers.success.length !== 0) resp += `Softbanned the following: ${banMembers.success.join(', ')}\n`
                if (banMembers.error.length !== 0) resp += `Could not softban the following: ${banMembers.error.join(', ')}\n`
                resp += `Reason provided by user: ${reason}`
                m.edit(resp)
              }
            }).catch(() => {
              banMembers.error.push(`\`${member.username}#${member.discriminator}\``)
              if (banMembers.success.length + banMembers.error.length === idArray.length) {
                let resp = ''
                if (banMembers.success.length !== 0) resp += `Softbanned the following: ${banMembers.success.join(', ')}\n`
                if (banMembers.error.length !== 0) resp += `Could not softban the following: ${banMembers.error.join(', ')}\n`
                resp += `Reason provided by user: ${reason}`
                m.edit(resp)
              }
            })
          }).catch(() => {
            banMembers.error.push(`\`${member.username}#${member.discriminator}\``)
            if (banMembers.success.length + banMembers.error.length === idArray.length) {
              let resp = ''
              if (banMembers.success.length !== 0) resp += `Softbanned the following: ${banMembers.success.join(', ')}\n`
              if (banMembers.error.length !== 0) resp += `Could not softban the following: ${banMembers.error.join(', ')}\n`
              resp += `Reason provided by user: ${reason}`
              m.edit(resp)
            }
          })
        })
      })
    }
  }
}
