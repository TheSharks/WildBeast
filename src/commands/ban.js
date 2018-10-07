module.exports = {
  meta: {
    help: 'Ban a user.',
    usage: '@user [reason]',
    module: 'Admin',
    level: 0,
    noDM: true,
    permAddons: ['Ban Members']
  },
  fn: async function (msg, suffix) {
    if (!msg.member.permission.json.banMembers) return msg.channel.createMessage('You need to be able to ban members to use this command.')
    if (!msg.channel.guild.members.get(global.bot.user.id).permission.json.banMembers) return msg.channel.createMessage("I don't have permission to ban members!")
    if (!suffix) return msg.channel.createMessage('Please provide users to ban.')

    const chunks = suffix.split(' ')
    const ids = chunks.map(x => x.match(/([0-9]*)/)[1]).filter(x => x.length > 1 && x !== global.bot.id)
    const mentions = mapMentions(suffix)
    const toban = [...mentions, ...ids]
    if (!toban) return msg.channel.createMessage("Couldn't find users to ban with your input")
    const words = chunks.indexOf(chunks.filter(x => isNaN(x) && !x.match(/<@!?([0-9]*)>/))[0])
    const reason = words === -1 ? '' : chunks.slice(words).join(' ')
    const result = { fail: [], pass: [] }
    const message = await msg.channel.createMessage('Hold on...')
    console.log(toban)
    toban.forEach(x => {
      console.log(x)
      msg.channel.guild.banMember(x, 7, `${msg.author.username}#${msg.author.discriminator}: ${reason.length > 0 ? reason : 'No reason provided'}`)
        .then(() => {
          result.pass.push(x)
          if (x === toban[toban.length - 1]) finalize(message, result)
        })
        .catch(() => {
          result.fail.push(x)
          if (x === toban[toban.length - 1]) finalize(message, result)
        })
    })
  }
}
function finalize (message, result) {
  message.edit(`Banned ${result.pass.length} users.` + ((result.fail.length > 0) ? `\nFailed to ban ${result.fail.length} users` : ''))
}

function mapMentions (string, reg = /<@!?([0-9]*)>/g) {
  let res = []
  let x
  while ((x = reg.exec(string)) !== null) {
    if (x[1] !== global.bot.user.id) res.push(x[1])
  }
  return res
}
