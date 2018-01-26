let perms = require('../engines/permissions')

module.exports = {
  meta: {
    level: 7,
    timeout: 0,
    alias: ['set'],
    help: "Change someone's access level."
  },
  fn: async (msg, suffix) => {
    let mentions = mapMentions(suffix)
    let to = suffix.split(' ')[suffix.split(' ').length - 1]
    for (var user of mentions) { // TODO: map role mentions and change edit mode accordingly
      await perms.modify(msg.channel.guild, user, to)
      msg.channel.createMessage(`Permissions for ${msg.channel.guild.members.get(user).username} updated to ${to}.`)
    }
  }
}

function mapMentions (string) {
  let regex = /<@!?([0-9]*)>/g
  let res = []
  let x
  while ((x = regex.exec(string)) !== null) {
    res.push(x[1])
  }
  return res
}
