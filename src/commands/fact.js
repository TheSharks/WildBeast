const request = require('superagent')

module.exports = {
  meta: {
    help: 'I\'ll give you some interesting facts!',
    timeout: 5,
    module: 'Fun',
    level: 0
  },
  fn: function (msg) {
    request.get('http://www.fayd.org/api/fact.xml')
      .then(res => {
        if (res.statusCode !== 200) return global.i18n.send('API_ERROR', msg.channel)
        const x = require('xml-js').xml2js(res.text, {compact: true})
        return msg.channel.createMessage(x.facts.fact._text)
      })
  }
}
