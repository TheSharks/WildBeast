const Command = require('../../classes/Command')

module.exports = new Command(async function (msg) {
  const jimp = require('jimp')
  if (!msg.attachments[0]) return this.safeSendMessage(msg.channel, 'Please upload an image while using this command')
  try {
    const image = await jimp.read(msg.attachments[0].url)
    const buffer = await image.quality(1).getBufferAsync(jimp.MIME_JPEG)
    await this.safeSendMessage(msg.channel, '', {
      file: buffer,
      name: 'needsmore.jpg'
    })
  } catch (e) {
    logger.error(e)
    this.safeSendMessage(msg.channel, 'Something went terribly wrong!')
  }
}, {
  clientPerms: {
    channel: ['attachFiles']
  }
})
