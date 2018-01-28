module.exports = function (ctx) {
  global.logger.debug(`Gateways: ${ctx[0]}`, {
    gateways: ctx[0]
  })
}
