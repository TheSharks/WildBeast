var Config = require('../../config.json')
var Websocket = require('ws')
var Bezerk
var Logger = require('./logger.js').Logger

var bot // eslint-disable-line

if (Config.bezerk.use === true) {
  Bezerk = new Websocket(Config.bezerk.uri)
  var argv = require('minimist')(process.argv.slice(2))
  Bezerk.on('open', () => {
    (argv.shardid === null) ? argv.shardid = 1 : argv.shardid = argv.shardid
    (argv.shardcout === null) ? argv.shardcout = 1 : argv.shardcout = argv.shardcout
    Bezerk.send(JSON.stringify({
      op: 'IDENTIFY_SHARD',
      c: [argv.shardid, argv.shardcount]
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
    try {
      if (!msg.c) return
      Bezerk.send(JSON.stringify({
        op: 'EVAL_REPLY',
        c: eval(msg.c)
      }))
    } catch (e) {
      Bezerk.send(JSON.stringify({
        op: 'EVAL_REPLY',
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
