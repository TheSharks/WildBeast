import { ScheduledJob } from './base'
import cluster from '../structures/cluster'
import { ClusterClient } from 'detritus-client'
import { jobs } from '../cache'
import fetch from 'node-fetch'
import { debug } from '../utils/logger'

// no import - messes with tsc (package.json is outside the source dir)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../package.json')

const jobName = 'bots-gg'

interface EvalReturnType {
  guilds: number
  user: {
    username: string
    discriminator: string
    id: string
    // theres more data here, but we don't need it
  }
}

const job = new ScheduledJob(jobName)
  .setInterval(1000 * 60 * 60) // every hour
  .setExec(async () => {
    const data: EvalReturnType[] = (await cluster.broadcastEval(() => {
      // in the context of broadcastEval, 'this' is the client
      const client = this as unknown as ClusterClient
      return {
        guilds: client.shards.reduce((a: number, b) => a + b.guilds.size, 0),
        user: client.shards.get(client.shards.size - 1)!.user!
      }
    }))
    const { user } = data[0]
    const guilds = data.reduce((a: number, b) => a + b.guilds, 0)
    const userAgent = `${user.username}-${user.discriminator}/${version as string} (Detritus; +https://github.com/TheSharks/WildBeast) DBots/${user.id}`
    await fetch(`https://discord.bots.gg/api/bots/${user.id}/stats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: process.env.BOTS_GG_TOKEN!,
        'User-Agent': userAgent
      },
      body: JSON.stringify({
        guildCount: guilds
      })
    })
  })

if (process.env.BOTS_GG_TOKEN !== undefined) {
  job.start()
  jobs.set(jobName, job)
} else {
  debug('Bots.gg stats disabled, missing BOTS_GG_TOKEN', jobName)
}
