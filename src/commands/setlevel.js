const perms = require('../features/permissions')

module.exports = {
  meta: {
    usage: '@user/@role @user2/@role2 <0-10>',
    help: 'Change someone\'s permission level.',
    module: 'Settings',
    level: 7,
    alias: ['set']
  },
  fn: async (msg, suffix) => {
    const mentions = mapMentions(suffix)
    const roles = mapMentions(suffix, /<@&([0-9]*)>/g)
    let to = suffix.split(' ')[suffix.split(' ').length - 1]
    if (isNaN(parseInt(to))) return global.i18n.send('INVALID_COMMAND_SYNTAX', msg.channel)
    if (to > 10) { // haha no
      return global.i18n.send('PERMISSIONS_OVERFLOW', msg.channel)
    }
    if (to === 0) to = null
    const data = {
      users: {},
      roles: {
        everyone: 0
      }
    }
    if (suffix.match(/@everyone/)) data.roles.everyone = to
    for (const user of mentions) {
      data.users[user] = to
    }
    for (const role of roles) {
      data.roles[role] = to
    }
    await perms.modifyBulk(msg.channel.guild, data)
    global.i18n.send('PERMISSIONS_UPDATED', msg.channel)
  }
}

function mapMentions (string, reg = /<@!?([0-9]*)>/g) {
  const res = []
  let x
  while ((x = reg.exec(string)) !== null) {
    res.push(x[1])
  }
  return res
}
