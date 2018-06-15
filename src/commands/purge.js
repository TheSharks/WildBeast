module.exports = {
  meta: {
    help: 'Delete multiple messages at once.',
    usage: '[author] @user <number>',
    module: 'Admin',
    level: 0,
    timeout: 5,
    noDM: true,
    alias: ['clean', 'filter']
  },
  fn: (msg, suffix) => {
    msg.mentions = msg.mentions.filter(u => u.id !== msg.channel.guild.shard.client.user.id) // why eris... why
    let memberPerms = msg.channel.permissionsOf(msg.author.id).json
    let botPerms = msg.channel.permissionsOf(msg.channel.guild.shard.client.user.id).json
    if (!botPerms.manageMessages) {
      msg.channel.createMessage({
        embed: {
          description: `<@${msg.author.id}>, I cannot manage messages here!`
        }
      }).catch(() => {})
    } else if (memberPerms.manageMessages) {
      let splitSuffix = suffix.split(' ')
      switch (splitSuffix[0]) {
        case 'author':
          let number
          if (!isNaN(splitSuffix[1]) && splitSuffix[1] < 100 && splitSuffix[1] >= 1) number = splitSuffix[1]
          else if (!isNaN(splitSuffix[2]) && splitSuffix[2] < 100 && splitSuffix[2] >= 1) number = splitSuffix[2]
          if (number) {
            if (msg.mentions.length === 1) {
              msg.channel.getMessages('500', msg.id).then((messages) => { // no b1nzy pls
                let deletable = []
                messages.forEach((message) => {
                  if (new Date(msg.timestamp) - new Date(message.timestamp) < 1209600000 && message.author.id === msg.mentions[0].id && deletable.length < number) {
                    deletable.push(message.id)
                  }
                })
                msg.delete().catch(() => {})
                if (deletable.length !== 0) {
                  msg.channel.deleteMessages(deletable).then(() => {
                    msg.channel.createMessage({
                      embed: {
                        color: 4324655,
                        description: `<@${msg.author.id}>, I was able to remove ${deletable.length} out of ${number} messages requested.`
                      }
                    }).then((m) => setTimeout(() => m.delete(), 7000))
                  })
                } else {
                  msg.channel.createMessage({
                    embed: {
                      color: 16711680,
                      description: `<@${msg.author.id}>, I was not able to find any messages for purging that are under two weeks old.`
                    }
                  }).then((m) => setTimeout(() => m.delete(), 7000))
                }
              })
            } else {
              msg.channel.createMessage({
                embed: {
                  color: 16711680,
                  description: `<@${msg.author.id}>, invalid usage. Try reading help.`
                }
              })
            }
          } else {
            msg.channel.createMessage({
              embed: {
                color: 16711680,
                description: `<@${msg.author.id}>, invalid number provided! Try reading help.`
              }
            })
          }
          break
        default: {
          if (!isNaN(splitSuffix[0]) && splitSuffix[0] < 100) {
            msg.channel.getMessages(splitSuffix[0], msg.id).then((messages) => { // no b1nzy pls
              let deletable = []
              messages.forEach((message) => {
                if (new Date(msg.timestamp) - new Date(message.timestamp) < 1209600000 && deletable.length < splitSuffix[0]) {
                  deletable.push(message.id)
                }
              })
              msg.delete().catch(() => {})
              if (deletable.length !== 0) {
                msg.channel.deleteMessages(deletable).then(() => {
                  msg.channel.createMessage({
                    embed: {
                      color: 4324655,
                      description: `<@${msg.author.id}>, I was able to remove ${deletable.length} out of ${splitSuffix[0]} messages requested.`
                    }
                  }).then((m) => setTimeout(() => m.delete(), 7000))
                })
              } else {
                msg.channel.createMessage({
                  embed: {
                    color: 16711680,
                    description: `<@${msg.author.id}>, I was not able to find any messages for purging that are under two weeks old.`
                  }
                }).then((m) => setTimeout(() => m.delete(), 7000))
              }
            })
          } else {
            msg.channel.createMessage({
              embed: {
                color: 16711680,
                description: `<@${msg.author.id}>, invalid usage. Try reading help.`
              }
            })
          }
        }
      }
    } else {
      msg.channel.createMessage({
        embed: {
          color: 16711680,
          description: `<@${msg.author.id}>, you lack the permissions required to purge messages (manage messages)!`
        }
      })
    }
  } // soon
}
