/*global Promise*/
var ask = require('inquirer')
var Logger = require('./logger.js').Logger

exports.initial = function () {
  return new Promise(function (resolve, reject) {
    Logger.info("Hello! I've noticed this is the first time you're using version 3.0.0 of WildBeast, therefore I need to ask some questions.")
    ask.prompt([
      {
        type: 'confirm',
        name: 'olduser',
        message: 'Have you used an instance of WildBeast before?'
      }, {
        type: 'list',
        name: 'lastver',
        message: "What version of WildBeast was the latest one you've run?",
        choices: ['2.1.x or higher', '2.0.x', '2.0.0-gamma.x', '2.0.0-beta.x'],
        when: function (a) {
          return a.olduser
        }
      }, {
        type: 'confirm',
        name: 'tokenask',
        message: 'Do you have a bot account that you wish to run WildBeast on? (a token instead of email/password)',
        when: function (a) {
          return !a.olduser
        }
      }, {
        type: 'input',
        name: 'token',
        message: 'Please enter your token.',
        when: function (a) {
          return a.tokenask
        }
      }, {
        type: 'confirm',
        name: 'usersure',
        message: 'Are you sure you want to use an user account? This is NOT officially supported by WildBeast and Discord, and can/will cause problems.',
        when: function (a) {
          return !a.tokenask && !a.olduser
        }
      }, {
        type: 'input',
        name: 'email',
        message: 'Please enter the email adress of the account you want to use.',
        when: function (a) {
          return !a.token && !a.olduser && !a.usersure
        }
      }, {
        type: 'input',
        name: 'password',
        message: 'Please enter the password of the account you want to use.',
        when: function (a) {
          return !a.token && !a.olduser && !a.usersure
        }
      }, {
        type: 'input',
        name: 'master',
        message: 'Please enter 1 Discord ID that I need to treat as my master, you can add more later.',
        when: function (a) {
          return !a.olduser && !a.usersure
        }
      }, {
        type: 'input',
        name: 'prefix',
        message: 'Please enter the prefix you want to use. (example: ++)',
        when: function (a) {
          return !a.olduser && !a.usersure
        }
      }],
      function (a) {
        Logger.debug(JSON.stringify(a))
        if (a.usersure) {
          Logger.info('Okay, please restart WildBeast to rerun the initial setup.')
          process.exit(0)
        }
        if (!a.olduser) {
          Logger.info("Great, I'll create a config file for you with the given info.")
          var data = {
            'bot': {
              'isbot': a.tokenask,
              'token': a.token,
              'email': a.email,
              'password': a.password
            },
            'settings': {
              'prefix': a.prefix
            },
            'permissions': {
              'master': [a.master, 'extend this array if you want more masters'],
              'level1': [],
              'level2': [],
              'level3': []
            },
            'api_keys': {
              'imgflip': {
                'username': 'Imgflip username',
                'password': 'imgflip password'
              },
              'google': 'A google key',
              'mashape': 'A mashape key',
              'cse': 'Custom Search Engine token, the wiki describes this'
            }
          }
          try {
            require('fs').writeFileSync('./config.json', JSON.stringify(data))
            require('fs').writeFileSync('./runtime/initial.txt', 'This is to confirm that you have ran the initial setup, if you delete this file, the setup will start again.')
            Logger.info('Done! Starting WildBeast now!')
            resolve()
          } catch (e) {
            Logger.error('Writing the config file failed...')
            Logger.error(e)
            reject()
          }
        } else {
          if (a.lastver === '2.0.x' || a.lastver === '2.1.x or higher') {
            Logger.info("Perfect, I'll import your previous settings, this might take a while.")
            require('./upgrade.js').init().then(function () {
              require('fs').writeFileSync('./runtime/initial.txt', 'This is to confirm that you have ran the initial setup, if you delete this file, the setup will start again.')
              Logger.info('Done! Starting WildBeast now!')
              resolve()
            }).catch(function (e) {
              Logger.warn('Something went wrong while upgrading, trying to start anyway.')
              Logger.debug('Upgrade error: ' + e)
              resolve()
            })
          } else {
            Logger.info("That version is not compatible with automatic database conversion, so I can't transfer your permission database over.")
            require('./upgrade.js').incomInit().then(function () {
              require('fs').writeFileSync('./runtime/initial.txt', 'This is to confirm that you have ran the initial setup, if you delete this file, the setup will start again.')
              Logger.info('Done! Starting WildBeast now!')
              resolve()
            }).catch(function (e) {
              Logger.warn('Something went wrong while upgrading, trying to start anyway.')
              Logger.debug('Upgrade error: ' + e)
              resolve()
            })
          }
        }
      })
  })
}
