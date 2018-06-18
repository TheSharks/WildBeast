module.exports = {
  meta: {
    help: 'Give a role to user or users.',
    usage: '@user @user2 <role name>',
    module: 'Admin',
    level: 0,
    noDM: true,
    alias: ['applyrole'],
    permAddons: ['Manage Roles']
  },
  fn: function (msg, suffix) {
    const guildPerms = msg.member.permission.json
    const botPerms = msg.channel.guild.members.get(global.bot.user.id).permission.json
    const roleToAdd = suffix.split(' ').splice(msg.mentions.filter(m => m.id !== global.bot.user.id).length).join(' ')
    const regExp = new RegExp(roleToAdd, 'i')
    const role = msg.channel.guild.roles.find(r => r.name === roleToAdd)
    if (!role) msg.channel.guild.roles.find(r => r.name.match(regExp))
    if (!guildPerms.manageRoles) {
      msg.channel.createMessage(`<@${msg.author.id}>, You don't have Manage Roles permission here.`)
    } else if (!botPerms.manageRoles) {
      msg.channel.createMessage('I don\'t have Manage Roles permission here, sorry!')
    } else if (msg.mentions.filter(u => u.id !== global.bot.user.id).length === 0 && !msg.mentionEveryone) {
      msg.channel.createMessage(`<@${msg.author.id}>, Please @mention the user(s) you want to give the role to.`)
    } else if (!role) {
      msg.channel.createMessage(`<@${msg.author.id}>, The role does not seem to exist. Check your spelling and remember that this command is case sensitive.`)
    } else {
      msg.mentions.filter(m => m.id !== global.bot.user.id).forEach((mention) => {
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
