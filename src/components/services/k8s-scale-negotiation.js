const k8s = require('../../internal/k8s-scaling')
const client = require('../client')
const stall = require('util').promisify(setTimeout)

module.exports = {
  fn: async () => {
    const scale = await k8s.renegotiate()
    if (client.options.maxShards !== scale) {
      while (true) {
        const res = await k8s.determine(false)
        if (res !== scale) {
          logger.log('K8S-SCALE', 'Retrying in 10 seconds, pod index seems to be inaccurate')
          await stall(10000)
        } else break
      }
    }
  },
  interval: (3600000 * 8),
  runCheck: () => (!!process.env.WILDBEAST_K8S_AUTOSCALE && client.options.firstShardID === 0)
}
