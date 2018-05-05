const request = require('superagent')

module.exports = {
  meta: {
    help: 'I\'ll fetch what idiots on the internet think something means',
    alias: ['ud', 'urban'],
    timeout: 10,
    module: 'Fun',
    level: 0
  },
  fn: function (msg, suffix) {
    if (!suffix) {
      msg.channel.createMessage(`<@${msg.author.id}>, Yes, let's just look up absolutely nothing.`)
    } else {
      request.get('http://api.urbandictionary.com/v0/define')
        .query({term: suffix})
        .end((err, res) => {
          if (!err && res.status === 200) {
            const uD = res.body
            if (uD.result_type !== 'no_results') {
              msg.channel.createMessage({
                embed: {
                  color: 0x6832e3,
                  author: {name: 'UrbanDictionary'},
                  title: `The internet's definition of ${uD.list[0].word}`,
                  url: uD.list[0].permalink,
                  description: uD.list[0].definition,
                  timestamp: new Date(),
                  fields: [
                    {name: 'Example', value: `\`\`\`${uD.list[0].example}\`\`\``},
                    {name: 'Thumbs up', value: `\`\`\`${uD.list[0].thumbs_up}\`\`\``, inline: true},
                    {name: 'Thumbs down', value: `\`\`\`${uD.list[0].thumbs_down}\`\`\``, inline: true}
                  ]
                }
              })
            } else {
              msg.channel.createMessage(`<@${msg.author.id}>, ${suffix}: This word is so screwed up, even Urban Dictionary doesn't have it in its database`)
            }
          } else {
            global.logger.error(`Got an error: ${err}, status code: ${res.status}`)
          }
        })
    }
  }
}
