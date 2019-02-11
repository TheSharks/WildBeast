// FIXME: This is currently a really hacky way to make K8S work
// FIXME: This relies on the workload being inside a StatefulSet
// HACK: The K8S downwards API doesn't allow passing of the SatefulSet index, but the hostnames are consistent

const OS = require('os')

module.exports = new Promise(async (resolve, reject) => {
  if (!process.env.K8S_AUTOSCALE) return resolve({ total: process.env.WILDBEAST_SHARDS_TOTAL || 1, mine: process.env.WILDBEAST_SHARDS_MINE || 0 })
  const hs = OS.hostname().match(/[\w]+-([\d]+)/)[1]
  return resolve({ total: parseInt(process.env.WILDBEAST_SHARDS_TOTAL), mine: parseInt(hs) })
})
