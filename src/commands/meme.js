module.exports = {
  meta: {
    name: 'meme',
    help: 'I\'ll create a meme with your suffixes! meme <memetype> "<Upper line>" "<Bottom line>" **Quotes are important!**',
    alias: ['makeameme'],
    timeout: 10,
    level: 0
  },
  fn: function (msg, suffix, bot) {
    var tags = suffix.split('"')
    var memetype = tags[0].split(' ')[0]
    var meme = require('./memes.json')
    var Imgflipper = require('imgflipper')
    var imgflipper = new Imgflipper(process.env.IMGFLIP_USERNAME, process.env.IMGFLIP_PASSWORD)
    imgflipper.generateMeme(meme[memetype], tags[1] ? tags[1] : '', tags[3] ? tags[3] : '', (err, image) => {
      if (err) {
        msg.channel.createMessage(`<@${msg.author.id}>, Please try again, use \`help meme\` if you do not know how to use this command.`)
      } else {
        var user = bot.user
        if (msg.channel.guild) {
          msg.channel.createMessage(image)
        } else if (msg.channel.guild.members.get(user.id).permission.json.manageMessages) {
          msg.delete()
          msg.channel.createMessage(image)
        } else {
          msg.channel.createMessage(image)
        }
      }
    })
  }
}
