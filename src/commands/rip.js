module.exports = {
  meta: {
    level: 0,
    help: 'Rip whoever you mention. Or you.',
    timeout: 10
  },
  fn: function (msg, suffix) {
    const qs = require('querystring')
    let resolve = []
    let skipped = false
    if (msg.mentions.length > 0) {
      for (var m of msg.mentions) {
        if (m.id !== msg.channel.guild.shard.client.user.id) {
          if (resolve[0] === undefined) {
            resolve[0] = m.username
          } else {
            resolve[0] += ' and ' + m.username
          }
        } else {
          skipped = true
        }
      }
    } else if (suffix) {
      resolve[0] = suffix
    }
    if (skipped === true && msg.mentions.length === 1 && suffix) {
      resolve[0] = suffix
    }
    msg.channel.createMessage('http://ripme.xyz/' + qs.stringify(resolve).substr(2))
  }
}
