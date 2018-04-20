module.exports = {
  meta: {
    level: 0,
    help: 'Rip whoever you mention. Or you.',
    module: 'Fun',
    timeout: 10
  },
  fn: function (msg, suffix) {
    mapMentions(suffix).forEach(y => {
      suffix = suffix.replace(new RegExp(`<@!?${y}>`, 'g'), global.bot.users.get(y).username)
    })
    msg.channel.createMessage('http://ripme.xyz/' + encodeURI(suffix))
  }
}

function mapMentions (string, reg = /<@!?([0-9]*)>/g) {
  let res = []
  let x
  while ((x = reg.exec(string)) !== null) {
    res.push(x[1])
  }
  return res
}
