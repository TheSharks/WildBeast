import { ScheduledJob } from './base'
import { flush, drop } from '../utils/elastic'
import { debug } from '../utils/logger'

export default new ScheduledJob('elastic-flush')
  // every hour
  .setInterval(60 * 60 * 1000)
  .setExec(async () => {
    if (process.env.ELASTIC_URL === undefined) {
      debug('No elastic url set, skipping elastic flush and resetting cache', 'Elastic')
      drop()
    } else await flush()
  })
  .start()
