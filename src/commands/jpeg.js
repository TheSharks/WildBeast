const urlregex = new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&/=]*)/)
const isURL = (input) => {
  return input.match(urlregex)
}

module.exports = {
  meta: {
    help: 'Needs more JPEG',
    usage: '<image>',
    module: 'Fun',
    alias: ['needsmorejpeg'],
    level: 0,
    timeout: 5
  },
  fn: function (msg, suffix) {
    if (!msg.attachments[0] && !isURL(suffix)) return global.i18n.send('INVALID_COMMAND_SYNTAX', msg.channel)
    const jimp = require('jimp')
    jimp.read(msg.attachments[0] ? msg.attachments[0].url : suffix).then(async image => {
      const buffer = await image.quality(1).getBufferAsync(jimp.MIME_JPEG)
      msg.channel.createMessage('', {
        file: buffer,
        name: 'needsmore.jpg'
      })
    }).catch(e => {
      global.logger.error(e)
      msg.channel.createMessage('Something went terribly wrong!')
    })
  }
}
