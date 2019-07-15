const { events } = require('../components/analytics')

module.exports = ctx => {
  if (ctx.t) events.labels(ctx.t).inc()
}
