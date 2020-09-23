const Command = require('../../classes/Command')

module.exports = new Command(async function (msg) {
  const jimp = require('jimp')
  if (!msg.attachments[0]) return this.safeSendMessage(msg.channel, i18n.t('commands.common.attachmentNeeded'))
  try {
    const image = await jimp.read(msg.attachments[0].url)
    const buffer = await image.quality(1).getBufferAsync(jimp.MIME_JPEG)
    await this.safeSendMessage(msg.channel, '', {
      file: buffer,
      name: 'needsmore.jpg'
    })
  } catch (e) {
    logger.error('CMD', e)
    this.safeSendMessage(msg.channel, i18n.t('commands.common.softFail'))
  }
}, {
  clientPerms: {
    channel: ['attachFiles']
  }
})
