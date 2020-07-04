const Command = require('../../classes/Command')

module.exports = new Command(function (msg, suffix) {
  const util = require('util')
  try {
    const returned = eval(suffix) // eslint-disable-line no-eval
    let str = util.inspect(returned, {
      depth: 1
    })
    if (str.length > 1900) {
      str = str.substr(0, 1897)
      str = str + '...'
    }
    str = str.replace(new RegExp(process.env.BOT_TOKEN, 'gi'), '( ͡° ͜ʖ ͡°)')
    this.safeSendMessage(msg.channel, '```js\n' + str + '\n```').then((ms) => {
      if (returned !== undefined && returned !== null && typeof returned.then === 'function') {
        returned.then(() => {
          let str = util.inspect(returned, {
            depth: 1
          })
          if (str.length > 1900) {
            str = str.substr(0, 1897)
            str = str + '...'
          }
          ms.edit('```js\n' + str + '\n```')
        }, (e) => {
          let str = util.inspect(e, {
            depth: 1
          })
          if (str.length > 1900) {
            str = str.substr(0, 1897)
            str = str + '...'
          }
          ms.edit('```js\n' + str + '\n```')
        })
      }
    })
  } catch (e) {
    this.safeSendMessage(msg.channel, '```js\n' + e + '\n```')
  }
}, {
  prereqs: ['masterUser'],
  hidden: true
})
