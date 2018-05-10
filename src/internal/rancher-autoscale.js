const SA = require('superagent')

module.exports = new Promise(async (resolve, reject) => {
  if (!process.env.RANCHER_AUTOSCALE) return resolve({total: process.env.WILDBEAST_SHARDS_TOTAL || 1, mine: process.env.WILDBEAST_SHARDS_MINE || 0})
  const scale = await SA.get('http://rancher-metadata/latest/self/service/scale')
  const mine = await SA.get('http://rancher-metadata/latest/self/container/service_index')
  return resolve({total: parseInt(scale.text), mine: parseInt(mine.text) - 1})
})

if (process.env.RANCHER_AUTOSCALE) {
  setInterval(async () => {
    const scale = await SA.get('http://rancher-metadata/latest/self/service/scale')
    if (parseInt(scale.text) !== global.bot.options.maxShards) {
      global.logger.warn(`Scaling configuration changed, restarting.`)
      process.exit(0) // we could reconfigure the client somehow, but exiting is faster lol
    }
  }, 120000)
}
