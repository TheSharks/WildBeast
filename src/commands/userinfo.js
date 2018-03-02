const notablePermissions = [
  'kickMembers',
  'banMembers',
  'administrator',
  'manageChanneks',
  'manageGuilds',
  'manageMessages',
  'manageRoles',
  'manageEmojis',
  'manageWebhooks'
]

module.exports = {
  meta: {
    level: 0,
    timeout: 5,
    noDM: true,
    alias: ['user-info'],
    help: 'I\'ll return information about the given userid, mention, or username.'
  },
  fn: (msg, suffix) => {
    let fields = []
    let user = msg.channel.guild.members.filter(m => m.nick).filter(m => m.nick.toLowerCase().includes(suffix.toLowerCase()))[0]
    if (!user) user = msg.channel.guild.members.find(m => m.username.toLowerCase().includes(suffix.toLowerCase()))
    if (!user) user = msg.channel.guild.members.filter(u => u.id === suffix)[0]
    if (msg.mentions.length !== 0) {
      user = msg.channel.guild.members.get(msg.mentions[0].id)
    }
    if (!suffix) {
      user = msg.member
    }
    if (user) {
      let perms = []
      let color = 12552203 // away color
      if (user.status === 'online') {
        color = 8383059
      } else if (user.status === 'offline') {
        color = 12041157
      } else if (user.status === 'dnd') {
        color = 16396122
      }
      Object.keys(user.permission.json).forEach((perm) => {
        if (user.permission.json[perm] === true && notablePermissions.indexOf(perm) !== -1) {
          perms.push(perm)
        }
      })
      if (perms.length === 0) {
        perms.push('None')
      }
      fields.push({
        name: 'Name',
        value: `**${user.username}#${user.discriminator}** ${user.nick ? `(**${user.nick}**)` : ''} (${user.id})\n${user.avatar.startsWith('a_') ? 'Animated PFP' : ''}`
      }, {
        name: 'Join Date',
        value: `${new Date(user.joinedAt)}`
      }, {
        name: 'Creation Date',
        value: `${new Date(user.createdAt).toString().substr(0, 21)}`
      }, {
        name: 'Roles',
        value: `${user.roles.length !== 0 ? `\`\`\`${user.roles.map(r => msg.channel.guild.roles.get(r).name).join(', ')}\`\`\`` : '```None```'}`
      }, {
        name: 'Notable Permissions',
        value: `\`\`\`${perms.join(', ')}\`\`\``
      })
      msg.channel.createMessage({embed: {
        timestamp: new Date(msg.timestamp),
        color: color,
        thumbnail: {
          url: user.avatar ? user.avatarURL : `https://cdn.discordapp.com/embed/avatars/${user.discriminator % 5}.png`
        },
        fields: fields
      }}).catch(() => {})
    } else {
      msg.channel.createMessage({embed: {
        color: 16396122,
        description: '**The specified user isn\'t a member of the server**'
      }}).catch(() => {})
    }
  }
}
