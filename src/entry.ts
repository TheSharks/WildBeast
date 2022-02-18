import { fatal, info } from './utils/logger'
import client from './structures/client'
import * as Sentry from '@sentry/node'
import { RewriteFrames } from '@sentry/integrations'
import { promisify } from 'util'
import { exec } from 'child_process'
import dirImport from './utils/dir-import'
import initLangs from './languages'

info('Starting up...', 'Preflight');

(async () => {
  const revision = process.env.GIT_COMMIT ??
    (await promisify(exec)('git rev-parse HEAD').catch(() => ({ stdout: undefined }))).stdout?.toString().trim() ??
    process.env.npm_package_version ??
    'unknown'
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
  await initLangs()
  await dirImport('@(dist|src)/events/**/*.[?jt]s')
  await client.addMultipleIn('./interactions')
  await client.run()
  await dirImport('@(dist|src)/jobs/**/*.client.[?jt]s')
  await client.checkAndUploadCommands()
})().catch(e => fatal(e, 'Startup'))
