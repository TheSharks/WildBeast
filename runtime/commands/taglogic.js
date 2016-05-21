var Commands = []
var Database = require('nedb')
var Config = require('../../config.json')
var db = new Database({
  filename: './runtime/databases/tags',
  autoload: true
})

Commands.tag = {
  name: 'tag',
  help: 'Tags!',
  level: 0,
  usage: '<create/delete> <tagname> [content] OR <tagname>',
  aliases: ['t'],
  noDM: true,
  fn: function (msg, suffix, bot) {
    var index = suffix.split(' ')
    if (index[0].toLowerCase() === 'create') {
      if (Config.permissions.master.indexOf(msg.author.id) === -1) {
        var re = /(discord(\.gg|app\.com\/invite)\/([\w]{16}|([\w]+-?){3}))/
        if (msg.mentions.length >= 5) {
          msg.reply('No more than five mentions at a time please.')
          return
        } else if (re.test(msg.content)) {
          msg.reply('Lol no thanks, not saving that.')
          return
        }
      }
      var content = index.slice(2, index.length).join(' ')
      db.find({
        _id: index[1].toLowerCase()
      }, function (err, res) {
        if (err) {
          msg.channel.sendMessage('Something went wrong.')
        } else if (res) {
          if (res.length > 0) {
            msg.channel.sendMessage('A tag with that name already exists.')
            return
          }
        }
      })
      db.insert({
        _id: index[1].toLowerCase(),
        content: content,
        owner: msg.author.id
      }, function (err, res) {
        if (err) {
          msg.channel.sendMessage('Something went wrong.')
        } else if (res) {
          msg.channel.sendMessage('Tag created :ok_hand:')
        }
      })
    } else if (index[0] === 'owner') {
      db.find({
        _id: index[1].toLowerCase()
      }, function (err, res) {
        if (err) {
          msg.channel.sendMessage('Something went wrong.')
        } else if (res) {
          if (res.length === 0) {
            msg.channel.sendMessage('That tag does not exist.')
            return
          } else {
            var o = bot.Users.get(res[0].owner).username
            msg.channel.sendMessage(`The owner of that tag is ${o !== null ? o : '`Unknown`'}`)
          }
        }
      })
    } else if (index[0].toLowerCase() === 'edit') {
      db.find({
        _id: index[1].toLowerCase()
      }, function (err, res) {
        if (err) {
          msg.channel.sendMessage('Something went wrong.')
        } else if (res) {
          if (res.length === 0) {
            msg.channel.sendMessage('That tag does not exist.')
            return
          }
          if (res[0].owner !== msg.author.id && Config.permissions.master.indexOf(msg.author.id) === -1) {
            msg.channel.sendMessage('That tag is not yours to edit.')
          } else {
            if (Config.permissions.master.indexOf(msg.author.id) === -1) {
              var re = /(discord(\.gg|app\.com\/invite)\/([\w]{16}|([\w]+-?){3}))/
              if (msg.mentions.length >= 5) {
                msg.reply('No more than five mentions at a time please.')
                return
              } else if (re.test(msg.content)) {
                msg.reply('Lol no thanks, not saving that.')
                return
              }
            }
            var content = index.slice(2, index.length).join(' ')
            db.update({
              _id: index[1].toLowerCase()
            }, {
              content: content
            }, function (err, res) {
              if (err) {
                msg.channel.sendMessage('Something went wrong.')
              } else if (res) {
                msg.channel.sendMessage('Tag edited.')
              }
            })
          }
        }
      })
    } else if (index[0].toLowerCase() === 'delete') {
      db.find({
        _id: index[1].toLowerCase()
      }, function (err, res) {
        if (err) {
          msg.channel.sendMessage('Something went wrong.')
        } else if (res) {
          if (res.length === 0) {
            msg.channel.sendMessage('That tag does not exist.')
            return
          }
          if (res[0].owner !== msg.author.id && Config.permissions.master.indexOf(msg.author.id) === -1) {
            msg.channel.sendMessage('That tag is not yours to delete.')
          } else {
            db.remove({
              _id: index[1].toLowerCase()
            }, function (err, res) {
              if (err) {
                msg.channel.sendMessage('Something went wrong.')
              } else if (res) {
                msg.channel.sendMessage('Tag removed.')
              }
            })
          }
        }
      })
    } else {
      db.find({
        _id: index[0].toLowerCase()
      }, function (err, res) {
        if (err) {
          msg.channel.sendMessage('Something went wrong.')
        } else if (res) {
          if (res.length === 0) {
            msg.channel.sendMessage('That tag does not exist.')
            return
          } else {
            msg.channel.sendMessage(res[0].content.replace('@everyone', '@every\u200Bone').replace('@here', '@he\u200Bre'))
          }
        }
      })
    }
  }
}

exports.Commands = Commands
