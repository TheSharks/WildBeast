module.exports = {
  blacklist: async (channel) => {
    let matches = channel.topic.toLowerCase().match(/\[(\S+)]/g)
    if (matches) matches = matches.map(x => x.replace('[', '').replace(']', '')) // FIXME
    return calculate(matches)
  },
  checkDynPerm: async (cmd, guild) => {
    // TODO
  },
  changeDynPerm: async (cmd, guild, set) => {
    // TODO
  }
}

function calculate (matches) {
  let res = {allow: [], deny: []}
  if (matches) {
    matches.forEach(x => {
      if (x.startsWith('-')) res.deny.push(x.slice(1))
      else res.allow.push(x)
    })
  }
  return res
}
