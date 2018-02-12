module.exports = {
  meta: {
    level: 0,
    alias: ['applyrole'],
    help: 'Give a role to user or users. addrole @user1 @user2 rolename',
    noDM: true
  },
  fn: function (msg, suffix) {
    var guildPerms = msg.member.permission.json
    var botPerms = msg.channel.guild.members.get(msg.channel.guild.shard.client.user.id).permission.json
    let roleToAdd = suffix.split(' ').splice(msg.mentions.filter(m => m.id !== msg.channel.guild.shard.client.user.id).length).join(' ')
    let regExp = new RegExp(roleToAdd, 'i')
    let role = msg.channel.guild.roles.find(r => r.name === roleToAdd)
    if (!role) msg.channel.guild.roles.find(r => r.name.match(regExp))
    if (!guildPerms.manageRoles) {
      msg.channel.createMessage(`<@${msg.author.id}>, You don't have Manage Roles permission here.`)
    } else if (!botPerms.manageRoles) {
      msg.channel.createMessage('I don\'t have Manage Roles permission here, sorry!')
    } else if (msg.mentions.filter(u => u.id !== msg.channel.guild.shard.client.user.id).length === 0 && !msg.mentionEveryone) {
      msg.channel.createMessage(`<@${msg.author.id}>, Please @mention the user(s) you want to give the role to.`)
    } else if (!role) {
      msg.channel.createMessage(`<@${msg.author.id}>, The role does not seem to exist. Check your spelling and remember that this command is case sensitive.`)
    } else {
      msg.mentions.filter(m => m.id !== msg.channel.guild.shard.client.user.id).forEach((mention) => {
        let guildMember = msg.channel.guild.members.get(mention.id)
        guildMember.addRole(role.id, `Role added by ${msg.author.username}#${msg.author.discriminator}`).then(() => {
          msg.channel.createMessage({
            embed: {
              description: 'Role `' + role.name + '` successfully assigned to **' + guildMember.username + '**!',
              color: role.color ? role.color : 4324655
            }
          })
        }).catch(err => {
          if (err) {
            msg.channel.createMessage({
              embed: {
                description: `I cannot apply role *${role.name}* to *${mention.username}* because the role is above me in the hierarchy.`,
                color: 16711680
              }
            })
          }
        })
      })
    }
  }
}
