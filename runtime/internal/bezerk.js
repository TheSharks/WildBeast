var Config = require('../../config.json')
var Websocket = require('ws')
var Bezerk

var bot // eslint-disable-line

if (Config.bezerk.use === true) {
  Bezerk = new Websocket(Config.bezerk.uri)
  Bezerk.on('message', (m) => {
    try {
      Bezerk.send(JSON.stringify({
        op: 'EVAL_REPLY',
        c: eval(m)
      }))
    } catch (e) {
      Bezerk.send(JSON.stringify({
        op: 'EVAL_REPLY',
        c: e
      }))    
    }
  })
}

exports.emit = function(event, data, client) {
  if (Bezerk === undefined) return
  bot = client
  Bezerk.send(JSON.stringify({
    op: event,
    c: data
  }))
}