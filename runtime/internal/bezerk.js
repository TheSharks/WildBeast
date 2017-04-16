var Config = require('../../config.json')
var Websocket = require('ws')
var Bezerk
var Logger = require('./logger.js').Logger

var bot // eslint-disable-line

if (Config.bezerk.use === true) {
  init()
}

function init () {
  Bezerk = new Websocket(Config.bezerk.uri)
  var argv = require('minimist')(process.argv.slice(2))
  Bezerk.on('close', () => {
    Logger.warn('Bezerk connection lost, reconnecting...')
    setTimeout(init, 500)
  })
  Bezerk.on('open', () => {
    argv.shardid = (argv.shardid === undefined) ? 0 : argv.shardid
    Bezerk.send(JSON.stringify({
      op: 'IDENTIFY_SHARD',
      c: argv.shardid
    }))
  })
  Bezerk.on('message', (m) => {
    var msg
    try {
      msg = JSON.parse(m)
    } catch (e) {
      Bezerk.send(JSON.stringify({
        op: 'ERROR',
        c: e
      }))
      return
    }
    if (msg.op === 'OK') {
      Logger.info('Bezerk connection established.')
      return
    }
    if (!msg.c) return
    try {
      var resp = eval(msg.c) // eslint-disable-line no-eval
      Bezerk.send(JSON.stringify({
        op: 'EVAL_REPLY',
        c: resp
      }))
    } catch (e) {
      Bezerk.send(JSON.stringify({
        op: 'ERROR',
        c: e
      }))
    }
  })
}

exports.emit = function (event, data, client) {
  if (Bezerk === undefined || Bezerk.readyState !== 1) return
  bot = client
  Bezerk.send(JSON.stringify({
    op: event,
    c: data
  }))
}
