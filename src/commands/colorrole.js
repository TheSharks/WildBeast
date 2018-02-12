module.exports = {
  meta: {
    level: 0,
    help: 'I\'ll color a role you have! colorrole <rolename> <hexadecimal value ("#FFFFFF" or "FFFFFF")>',
    timeout: 5
  },
  fn: function (msg, suffix) {
    let bot = msg.channel.guild.shard.client
    var split = suffix.split(' ')
    var hex = split[split.length - 1]
    split.pop()
    var role = msg.channel.guild.roles.find(r => r.name === split.join(' '))
    var Reg = /^#?([\da-fA-F]{6})$/
    var botPerms = msg.channel.guild.members.get(bot.user.id).permission.json
    if (typeof role !== 'object' || hex.length === 0) {
      msg.channel.createMessage(`<@${msg.author.id}>, Input a valid role name and an hexadecimal value!`)
      return
    }
    if (!Reg.test(hex)) {
      msg.channel.createMessage(`<@${msg.author.id}>, Invalid hex value!`)
      return
    }
    if (!msg.member.roles.includes(role.id) && msg.author.id !== msg.channel.guild.ownerID) {
      msg.channel.createMessage(`<@${msg.author.id}>, You do not have that role!`)
      return
    }
    if (!botPerms.manageRoles) {
      msg.channel.createMessage(`<@${msg.author.id}>, I do not have Manage Roles permission here, sorry!`)
      return
    }
    var botRole = msg.channel.guild.members.get(bot.user.id).roles.map(r => msg.channel.guild.roles.get(r)).sort(function (a, b) {
      return a.position < b.position
    })[0]
    if (role.position >= botRole.position) {
      msg.channel.createMessage(`<@${msg.author.id}>, This role is higher or equal to my highest role, I cannot color it!`)
      return
    }
    role.edit({
      color: parseInt(hex.replace(Reg, '$1'), 16)
    }, `${msg.author.username}#${msg.author.discriminator} colored ${role.name} ${hex}.`)
    msg.channel.createMessage(`Colored the role ${role.name} with the value \`${hex}\`!`)
  }
}
