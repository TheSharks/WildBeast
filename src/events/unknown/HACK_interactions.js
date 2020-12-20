const interactions = require('../../components/interactions')

module.exports = async (ctx) => {
  if (ctx.t === 'INTERACTION_CREATE') {
    interactions.execute(ctx.d)
  }
}
