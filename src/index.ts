import { fatal, info } from './utils/logger'
import client from './structures/client'
import * as Sentry from '@sentry/node'
import { RewriteFrames } from '@sentry/integrations'
import { promisify } from 'util'
import { exec } from 'child_process'
import dirImport from './utils/dir-import'

info('Starting up...', 'Preflight');

(async () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const revision = (await promisify(exec)('git rev-parse HEAD').catch(() => { return { stdout: require('../package.json').version } })).stdout.toString().trim()
  info(`Initialzing Sentry, using revision ${revision as string}`, 'Preflight')
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: function (integrations) {
      return integrations
        .concat(new RewriteFrames({ root: __dirname ?? process.cwd() }))
        .filter(function (integration) {
          return integration.name !== 'Console'
        })
    },
    release: revision
  })
  await dirImport('@(dist|src)/languages/**/*.[?jt]s')
  await dirImport('@(dist|src)/events/**/*.[?jt]s')
  await client.addMultipleIn('./interactions')
  await client.run()
  await client.checkAndUploadCommands()
})().catch(e => fatal(e, 'Startup'))
