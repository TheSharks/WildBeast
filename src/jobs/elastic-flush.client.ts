import { ScheduledJob } from './base'
import { flush } from '../utils/elastic'

const job = new ScheduledJob('analytics-prune')
  // every hour
  .setInterval(60 * 60 * 1000)
  .setExec(async () => {
    await flush()
  })

if (process.env.ELASTIC_URL !== undefined) job.start()

export default job
