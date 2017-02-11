var Commands = []
const TagScript = require('tagscript')
let compiler = new TagScript()
var Config = require('../../config.json')
var Dash = require('rethinkdbdash')
var r = new Dash({
  user: Config.database.user,
  password: Config.database.password,
  silent: true,
  servers: [{
    host: Config.database.host,
    port: Config.database.port
  }]
})

Commands.tag = {
  name: 'tag',
  help: 'Tags!',
  level: 0,
  usage: '<create/edit/delete/owner/raw/list/random> <tagname> [content] OR <tagname>',
  aliases: ['t'],
  fn: function (msg, suffix, bot) {
    var index = suffix.split(' ')
    if (suffix) {
      if (index[1] !== undefined && index[0].toLowerCase() === 'create') {
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
        r.db('Discord').table('Tags').get(index[1].toLowerCase()).run().then((g) => {
          if (g !== null) {
            msg.channel.sendMessage('This tag already exists.')
          }
        })
        r.db('Discord').table('Tags').insert({
          id: index[1].toLowerCase(),
          content: content,
          owner: msg.author.id
        }).run().then((g) => {
          if (g.inserted === 1) {
            msg.channel.sendMessage('Tag successfully created.')
          } else if (g.errors > 1) {
            msg.channel.sendMessage('Something went wrong.')
          }
        })
      } else if (index[1] !== undefined && index[0] === 'owner') {
        r.db('Discord').table('Tags').get(index[1].toLowerCase()).run().then((g) => {
          if (g === null) {
            msg.channel.sendMessage('This tag does not exist.')
          } else {
            msg.channel.sendMessage(`The owner of that tag is ${bot.Users.get(g.owner) !== null ? bot.Users.get(g.owner).username : '`Unknown`'}`)
          }
        })
      } else if (index[0].toLowerCase() === 'edit') {
        r.db('Discord').table('Tags').get(index[1].toLowerCase()).run().then((g) => {
          if (g === null) {
            msg.channel.sendMessage('This tag does not exist.')
          } else {
            if (g.owner !== msg.author.id && Config.permissions.master.indexOf(msg.author.id) === -1) {
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
              r.db('Discord').table('Tags').get(index[1].toLowerCase()).update({
                content: content
              }).run().then((g) => {
                if (g.replaced === 1) {
                  msg.channel.sendMessage('Tag successfully edited.')
                } else if (g.errors > 1) {
                  msg.channel.sendMessage('Something went wrong.')
                }
              })
            }
          }
        })
      } else if (index[1] !== undefined && index[0].toLowerCase() === 'delete') {
        r.db('Discord').table('Tags').get(index[1].toLowerCase()).run().then((g) => {
          if (g === null) {
            msg.channel.sendMessage('This tag does not exist.')
          } else {
            if (g.owner !== msg.author.id && Config.permissions.master.indexOf(msg.author.id) === -1) {
              msg.channel.sendMessage('That tag is not yours to delete.')
            } else {
              r.db('Discord').table('Tags').get(index[1].toLowerCase()).delete().run().then((g) => {
                if (g.deleted === 1) {
                  msg.channel.sendMessage('Tag successfully deleted.')
                } else if (g.errors > 1) {
                  msg.channel.sendMessage('Something went wrong.')
                }
              })
            }
          }
        })
      } else if (index[1] !== undefined && index[0].toLowerCase() === 'raw') {
        r.db('Discord').table('Tags').get(index[1].toLowerCase()).run().then((g) => {
          if (g === null) {
            msg.channel.sendMessage('This tag does not exist.')
          } else {
            var cp = g.content.replace('@everyone', '@every\u200Bone').replace('@here', '@he\u200Bre')
            msg.channel.sendMessage('`' + cp + '`')
          }
        })
      } else if (index[0].toLowerCase() === 'list') {
        var author = msg.author
        if (index[1] && msg.mentions.length === 1) {
          author = msg.mentions[0]
        }
        r.db('Discord').table('Tags').filter({owner: author.id}).count().run().then((c) => {
          if (c === 0) {
            msg.channel.sendMessage(`${msg.author.id === author.id ? "You don't" : 'This user does not'} have any tags!`)
          } else {
            var tagsArray = []
            r.db('Discord').table('Tags').filter({owner: author.id}).run().then((tags) => {
              for (var i in tags) {
                tagsArray.push(tags[i].id)
              }
              if (tagsArray.join(', ').length > 1950) {
                msg.channel.sendMessage(`The length of ${msg.author.id === author.id ? 'your' : "this user's"} tag list exceeds 2000 characters.`)
                return
              }
              msg.channel.sendMessage(`Found ${c} tags for **${author.username}**:\n${tagsArray.join(', ')}`)
            })
          }
        })
      } else if (index[0].toLowerCase() === 'random') {
        r.db('Discord').table('Tags').count().run().then((c) => {
          if (c === 0) {
            msg.channel.sendMessage('No tags found in the database.')
          } else {
            r.db('Discord').table('Tags').sample(1).run().then((tag) => {
              var msgArray = []
              msgArray.push(`Tag: **${tag[0].id}**`)
              msgArray.push(tag[0].content)
              msg.channel.sendMessage(msgArray.join('\n'))
            })
          }
        })
      } else {
        r.db('Discord').table('Tags').get(index[0].toLowerCase()).run().then((g) => {
          if (g === null) {
            msg.channel.sendMessage('This tag does not exist.')
          } else {
            compiler.compile(g.content.replace('@everyone', '@every\u200Bone').replace('@here', '@he\u200Bre')).then((ts) => {
              msg.channel.sendMessage(ts)
            })
          }
        })
      }
    } else {
      msg.channel.sendMessage('No arguments entered.')
    }
  }
}

exports.Commands = Commands
