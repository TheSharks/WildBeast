/**
 * Represents a Sentry client
 * @type {module:@sentry/node}
 */
const Sentry = require('@sentry/node')
const { Modules, Http, LinkedErrors } = Sentry.Integrations
const { Dedupe } = require('@sentry/integrations')
let release
try {
  release = require('child_process').execSync('git rev-parse HEAD --short').toString().trim()
  logger.debug('SENTRY', `Setting release to ${release}`)
} catch (_) {
  release = require('../../package.json').version
  logger.debug('SENTRY', `Git failed, setting release to ${release}`)
}
Sentry.init({
  defaultIntegrations: false,
  dsn: process.env.SENTRY_DSN,
  integrations: [new Modules(), new Dedupe(), new Http(), new LinkedErrors()],
  ignoreErrors: [
    'src.commands.utils:eval',
    '500 Internal Server Error',
    'CloudFlare WebSocket proxy restarting',
    'Missing Permissions',
    'Missing Access',
    'Connection reset by peer'
  ],
  release: `thesharks/wildbeast@${release}`
})

module.exports = Sentry
