module.exports = (ctx) => {
  if (ctx[0] !== null && ctx[0].message === 'Authentication failed') logger.error('ERIS', 'Your token is incorrect, authentication failed', true)
  else (ctx[0] === null) ? logger.warn('ERIS', 'Client disconnected!') : logger.warn('ERIS', ctx[0])
}
