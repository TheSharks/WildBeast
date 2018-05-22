const StatsD = require('hot-shots')
const client = new StatsD({
  host: process.env.HOTSHOTS_HOST,
  prefix: process.env.HOTSHOTS_PREFIX || 'wildbeast.',
  errorHandler: global.logger.error
})

module.exports = {
  eventHook: (eventname) => {
    client.increment('events.all')
    if (eventname) client.increment(`events.${eventname}`)
  }
}