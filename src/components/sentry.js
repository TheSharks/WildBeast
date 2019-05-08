/**
 * Represents a Sentry client
 * @type {module:@sentry/node}
 */
const Sentry = require('@sentry/node')
const { Modules } = Sentry.Integrations
const { Dedupe } = require('@sentry/integrations')
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [ new Modules(), new Dedupe() ]
})

module.exports = Sentry
