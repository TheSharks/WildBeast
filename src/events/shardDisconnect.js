module.exports = function (ctx) {
  if (ctx[0].message === 'Authentication failed') global.logger.error('Your token is incorrect, authentication failed', true)
  else global.logger.warn(ctx[0])
}
