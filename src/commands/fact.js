const request = require('superagent')

module.exports = {
  meta: {
    help: 'I\'ll give you some interesting facts!',
    timeout: 5,
    level: 0
  },
  fn: function (msg) {
    var xml2js = require('xml2js')
    request.get('http://www.fayd.org/api/fact.xml')
      .end((err, res) => {
        if (err) {
          console.error(err)
        }
        if (!err && res.status === 200) {
          xml2js.parseString(res.text, function (err, result) {
            if (err) {
              console.error(err)
            }
            try {
              msg.channel.createMessage(`<@${msg.author.id}>, ${result.facts.fact[0]}`)
            } catch (e) {
              msg.channel.createMessage('The API returned an unconventional response.')
            }
          })
        }
      })
  }
}
