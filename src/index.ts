import { fatal, info } from './components/logger'
import client from './components/client'
import * as Sentry from '@sentry/node'
import { RewriteFrames } from '@sentry/integrations'
import { promisify } from 'util'
import { exec } from 'child_process'
import dirImport from './internal/dir-import'
import { update } from './components/interactions'

info('Starting up...', 'Preflight');

(async () => {
  const revision = (await promisify(exec)('git rev-parse HEAD').catch(() => { return { stdout: 'REVISION_UNKNOWN' } })).stdout.toString().trim()
  info(`Initialzing Sentry, using revision ${revision}`, 'Preflight')
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
  dirImport('@(dist|src)/events/**/*.[?jt]s')
  dirImport('@(dist|src)/languages/**/*.[?jt]s')
  dirImport('@(dist|src)/interactions/**/*.[?jt]s')
  await client.run()
  await update()
})().catch(e => fatal(e, 'Startup'))
