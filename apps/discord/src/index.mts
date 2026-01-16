import type { SapphireClient } from '@sapphire/framework'
import * as Sentry from '@sentry/node'
import { initOpenTelemetry } from '@thesharks/analytics'

// Must run as early as possible.
const telemetry = initOpenTelemetry({
  serviceName: '@thesharks/discord',
  namespace: '@thesharks',
  shardId: process.env.SHARD_ID,
})

async function shutdown() {
  try {
    await telemetry.shutdown()
  } finally {
    process.exit(0)
  }
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

let client: SapphireClient | undefined

try {
  const imported = await import('./structures/client.mjs')
  client = imported.client
  await client.login(process.env.DISCORD_TOKEN)
  client.logger.info('Logged in')
} catch (error) {
  Sentry.captureException(error)
  if (client) {
    client.logger?.fatal(error)
    client.destroy()
  }
  await Sentry.flush(2000)
  process.exit(1)
}
