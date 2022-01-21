import { ScheduledJob } from './base'
import db from '../database/driver'
import { error } from '../utils/logger'

export default new ScheduledJob('analytics-prune')
  .setInterval(1000 * 60 * 60 * 24) // every 24 hours
  .setExec(async () => {
    try {
      await db`DELETE FROM analytics WHERE timestamp < NOW() - INTERVAL '6 months';`
    } catch (err) {
      error(err, 'analytics-prune')
    }
  })
  .start()
