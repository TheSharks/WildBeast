import { fatal, info, trace, warn } from './components/logger'
import client from './components/client'
import dirImport from './internal/dir-import'
import { PlayerManager } from './classes/PlayerManager'
import * as Sentry from '@sentry/node'
import { RewriteFrames } from '@sentry/integrations'
import { Command } from './classes/Command'

info('Starting up...', 'Preflight')

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: function (integrations) {
    return integrations
      .concat(new RewriteFrames({ root: __dirname ?? process.cwd() }))
      .filter(function (integration) {
        return integration.name !== 'Console'
      })
  },
  release: 'TEST'
})

// @ts-expect-error
const a = new Command()
console.log(a.toJSON())

client.on('guildCreate', async ({ fromUnavailable, guild, shard }) => {
  warn('Got a new `guildCreate` event', 'guildCreate')
  if (fromUnavailable) {
    info(`Shard #${shard.shardId}: Guild ${guild.name} has just came back from being unavailable`, 'guildCreate')
  } else {
    info(`Shard #${shard.shardId}: Joined Guild ${guild.name}, bringing us up to ${shard.guilds.length} guilds.`, 'guildCreate')
  }
});

(async () => {
  trace(dirImport('dist/languages/*.js')['en-EN'])
  await client.run()
  setTimeout(() => {
    const thing = new PlayerManager()
    thing.connect(JSON.parse(process.env.LAVALINK_NODES ?? '[]'))
    client.on('voiceServerUpdate', (x) => thing.voiceServerUpdate(x))
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-floating-promises, @typescript-eslint/promise-function-async
    thing.join('110462143152803840', '302538492393816086', client.shards.first()!).then(x => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
      x.node.loadTracks('ytsearch:0qwsEdjKA2E').then(y => {
        console.log(y)
        x.play(y.tracks[0].track)
      })
    })
  }, 5000)
})().catch(e => fatal(e, 'startup'))
