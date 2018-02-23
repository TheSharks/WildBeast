const uri = process.env.BEZERK_URI
const secret = process.env.BEZERK_SECRET
const WS = require('ws')

let socket

function start () {
  global.logger.debug(`Bezerk connection started to ${uri}`)
  socket = new WS(uri)
  socket.on('error', e => {
    global.logger.error(`Bezerk socket error, ${e.message}`)
  })
  socket.on('close', () => {
    global.logger.warn('Bezerk socket got destroyed, reconnecting...')
    setTimeout(start, 500)
  })
  socket.on('message', m => {
    let msg
    try {
      msg = JSON.parse(m)
      global.logger.trace(msg)
    } catch (e) {
      return global.logger.warn('Failed to decrypt Bezerk payload, ' + e.message)
    }
    switch (msg.op) {
      case '1001': { // IDENTIFY
        return send({
          op: '1003', // IDENTIFY_SUPPLY
          c: {
            secret: secret
            /* shard: shardid */
          }
        })
      }
      case '1002': { // IDENTIFY_REPLY
        if (msg.c.success === true) {
          global.logger.debug(`Bezerk connection fully open.`)
          global.logger.log('Successfully connected to Bezerk.')
        } else {
          global.logger.warn('Bezerk rejected authentication! Not reconnecting.')
        }
        break
      }
      case '2001': { // REQUEST
        const bot = global.bot // eslint-disable-line
        try {
          const resp = eval(msg.c) // eslint-disable-line no-eval
          global.logger.trace(resp)
          send({
            op: '2002', // REQUEST_REPLY
            c: resp
          })
        } catch (e) {
          global.logger.debug(e)
          send({
            op: '5000', // CANNOT_COMPLY
            c: e.message
          })
        }
      }
    }
  })
}

function send (payload) {
  if (typeof payload === 'object') payload = JSON.stringify(payload)
  socket.send(payload)
}

if (uri && secret) start()
