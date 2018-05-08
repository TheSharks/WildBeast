const IRD = require('ioredis')
const redis = new IRD(process.env.HYPERSCALE_REDIS)

module.exports = {
  get: async (shardid) => {
    global.logger.debug(`Getting Hyperscale for ${shardid}`)
    const res = await redis.get(`hyperscale-${shardid}`)
    global.logger.trace(res)
    return JSON.parse(res)
  },
  set: async (shardid, data) => {
    global.logger.debug(`Setting Hyperscale for ${shardid}`)
    return redis.set(`hyperscale-${shardid}`, JSON.stringify(data)).then(global.logger.trace)
  }
}
