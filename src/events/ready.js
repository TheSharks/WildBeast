module.exports = () => {
  const client = require('../components/client')
  logger.log('BOOT', `Done starting up, logged in as ${client.user.username}#${client.user.discriminator} (${client.user.id})`)
}
