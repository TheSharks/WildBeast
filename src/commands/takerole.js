module.exports = {
  meta: {
    level: 0,
    alias: ['removerole'],
    help: 'Take a role from a user or users. takerole @user1 @user2 rolename',
    noDM: true
  },
  fn: function (msg, suffix) {
    const guildPerms = msg.member.permission.json
    const botPerms = msg.channel.guild.members.get(msg.channel.guild.shard.client.user.id).permission.json
    const roleToRemove = suffix.split(' ').splice(msg.mentions.filter(m => m.id !== msg.channel.guild.shard.client.user.id).length).join(' ')
    const regExp = new RegExp(roleToRemove, 'i')
    const role = msg.channel.guild.roles.find(r => r.name === roleToRemove)
    if (!role) msg.channel.guild.roles.find(r => r.name.match(regExp))
    if (!guildPerms.manageRoles) {
      msg.channel.createMessage(`<@${msg.author.id}>, You don't have Manage Roles permission here.`)
    } else if (!botPerms.manageRoles) {
      msg.channel.createMessage('I don\'t have Manage Roles permission here, sorry!')
    } else if (msg.mentions.filter(u => u.id !== msg.channel.guild.shard.client.user.id).length === 0 && !msg.mentionEveryone) {
      msg.channel.createMessage(`<@${msg.author.id}>, Please @mention the user(s) you want to remove the role from.`)
    } else if (!role) {
      msg.channel.createMessage(`<@${msg.author.id}>, The role does not seem to exist. Check your spelling and remember that this command is case sensitive.`)
    } else {
      msg.mentions.filter(m => m.id !== msg.channel.guild.shard.client.user.id).forEach((mention) => {
        let guildMember = msg.channel.guild.members.get(mention.id)
        guildMember.removeRole(role.id, `Role revoked by ${msg.author.username}#${msg.author.username}`).then(() => {
          msg.channel.createMessage({
            embed: {
              description: 'Role `' + role.name + '` successfully revoked from **' + guildMember.username + '**!',
              color: role.color ? role.color : 4324655
            }
          })
        }).catch(err => {
          if (err) {
            msg.channel.createMessage({
              embed: {
                description: `I cannot revoke role *${role.name}* from *${mention.username}* because the role is above me in the hierarchy.`,
                color: 16711680
              }
            })
          }
        })
      })
    }
  }
}
