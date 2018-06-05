process.env.WILDBEAST_MASTERS = '1' // HACK

const dex = require('./command-indexer')
const final = {}

for (const cmd in dex.commands) {
  final[cmd] = dex.commands[cmd].meta
  if (dex.commands[cmd].meta.level === Infinity) final[cmd].level = 'Infinity' // lol json
}

require('fs').writeFileSync('./info.json', JSON.stringify(final))
