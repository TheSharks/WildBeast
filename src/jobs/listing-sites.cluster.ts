import { ScheduledJob } from './base'
import cluster from '../structures/cluster'
import { ClusterClient } from 'detritus-client'
import fetch, { RequestInit } from 'node-fetch'
import { debug, error } from '../utils/logger'

// no import - messes with tsc (package.json is outside the source dir)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../package.json')

const jobName = 'listing-sites-update'

interface EvalReturnType {
  guilds: number
  user: {
    username: string
    discriminator: string
    id: string
    // theres more data here, but we don't need it
  }
}

interface ListingAPI {
  url: (data: EvalReturnType) => string
  init: (data: EvalReturnType) => RequestInit
  enabled: (data: EvalReturnType) => boolean
}

export const sites: ListingAPI[] = [
  {
    url: ({ user }) => `https://top.gg/api/bots/${user.id}/stats`,
    init: ({ guilds, user }) => ({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: process.env.TOP_GG_TOKEN!,
        'User-Agent': `${user.username}-${user.discriminator}/${version as string} (+https://github.com/TheSharks/WildBeast)`
      },
      body: JSON.stringify({
        server_count: guilds,
        shard_count: cluster.shardCount
      })
    }),
    enabled: () => process.env.TOP_GG_TOKEN !== undefined
  }, {
    url: ({ user }) => `https://discord.bots.gg/api/bots/${user.id}/stats`,
    init: ({ user, guilds }) => ({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: process.env.BOTS_GG_TOKEN!,
        'User-Agent': `${user.username}-${user.discriminator}/${version as string} (Detritus; +https://github.com/TheSharks/WildBeast) DBots/${user.id}`
      },
      body: JSON.stringify({
        guildCount: guilds
      })
    }),
    enabled: () => process.env.BOTS_GG_TOKEN !== undefined
  }, {
    url: ({ user }) => `https://discordbotlist.com/api/v1/bots/${user.id}/stats`,
    init: ({ user, guilds }) => ({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: process.env.DBL_COM_TOKEN!,
        'User-Agent': `${user.username}-${user.discriminator}/${version as string} (+https://github.com/TheSharks/WildBeast)`
      },
      body: JSON.stringify({
        guilds: guilds
      })
    }),
    enabled: () => process.env.DBL_COM_TOKEN !== undefined
  }, {
    url: ({ user }) => `https://bots.ondiscord.xyz/bot-api/bots/${user.id}/guilds`,
    init: ({ user, guilds }) => ({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: process.env.ONDISCORD_XYZ_TOKEN!,
        'User-Agent': `${user.username}-${user.discriminator}/${version as string} (+https://github.com/TheSharks/WildBeast)`
      },
      body: JSON.stringify({
        guildCount: guilds
      })
    }),
    enabled: () => process.env.ONDISCORD_XYZ_TOKEN !== undefined
  }, {
    url: ({ user }) => `https://api.discordextremelist.xyz/v2/bot/${user.id}/stats`,
    init: ({ user, guilds }) => ({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: process.env.DEL_XYZ_TOKEN!,
        'User-Agent': `${user.username}-${user.discriminator}/${version as string} (+https://github.com/TheSharks/WildBeast)`
      },
      body: JSON.stringify({
        guildCount: guilds,
        shardCount: cluster.shardCount
      })
    }),
    enabled: () => process.env.DEL_XYZ_TOKEN !== undefined
  }
]

export default new ScheduledJob(jobName)
  .setInterval(1000 * 60 * 60 * 8) // every 8 hours
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
    debug(`${user.username}#${user.discriminator} (${user.id}) has ${guilds} guilds`, jobName)
    const result = await Promise.allSettled(sites.filter(site => site.enabled({ user, guilds })).map(async (site) => {
      const url = site.url({ user, guilds })
      const init = site.init({ user, guilds })
      try {
        await fetch(url, init)
      } catch (e) {
        error(e, jobName)
      }
    }))
    debug(`Stats sent to ${result.filter(r => r.status === 'fulfilled').length} sites`, jobName)
    debug(`Stats failed to send to ${result.filter(r => r.status === 'rejected').length} sites`, jobName)
  })
  .start()
