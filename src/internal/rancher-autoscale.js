const SA = require('superagent')

module.exports = new Promise(async (resolve, reject) => {
  if (!process.env.RANCHER_AUTOSCALE) return resolve({total: process.env.WILDBEAST_SHARDS_TOTAL || 1, mine: process.env.WILDBEAST_SHARDS_MINE || 0})
  const scale = await SA.get('http://rancher-metadata/latest/self/service/scale')
  const mine = await SA.get('http://rancher-metadata/latest/self/container/service_index')
  return resolve({total: parseInt(scale.text), mine: parseInt(mine.text) - 1})
})
