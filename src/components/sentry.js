/**
 * Represents a Sentry client
 * @type {module:@sentry/node}
 */
const Sentry = require('@sentry/node')
const { Modules, Http, LinkedErrors } = Sentry.Integrations
const { Dedupe } = require('@sentry/integrations')
let release
try {
  release = require('child_process').execSync('git rev-parse HEAD').toString().trim()
} catch (_) {
  release = require('../../package.json').version
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
  release
})

module.exports = Sentry
