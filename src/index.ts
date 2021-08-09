import { fatal, info } from './internal/logger'
import client from './components/client'
import * as Sentry from '@sentry/node'
import { RewriteFrames } from '@sentry/integrations'
import { promisify } from 'util'
import { exec } from 'child_process'
import dirImport from './internal/dir-import'
import { update } from './components/interactions'

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
  await dirImport('@(dist|src)/interactions/**/*.[?jt]s')
  await client.run()
  await update()
})().catch(e => fatal(e, 'Startup'))
