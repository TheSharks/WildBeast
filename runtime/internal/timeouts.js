var cmdLastExecutedTime = {}
const Config = require('../../config.json')

exports.check = function (cmd, server, user) {
  return new Promise(function (resolve) {
    var isAllowResult = true
    if (Config.permissions.master.indexOf(user) > -1) {
      return resolve(true)
    }
    if (cmd.hasOwnProperty('timeout')) {
      if (cmdLastExecutedTime.hasOwnProperty(server)) {
        if (cmdLastExecutedTime[server].hasOwnProperty(cmd.name)) {
          var currentDateTime = new Date()
          var lastExecutedTime = new Date(cmdLastExecutedTime[server][cmd.name])
          lastExecutedTime.setSeconds(lastExecutedTime.getSeconds() + cmd.timeout)
          if (currentDateTime < lastExecutedTime) {
            isAllowResult = (lastExecutedTime - currentDateTime) / 1000
          } else {
            cmdLastExecutedTime[server][cmd.name] = new Date()
          }
        } else {
          cmdLastExecutedTime[server][cmd.name] = new Date()
        }
      } else {
        cmdLastExecutedTime[server] = {}
        cmdLastExecutedTime[server][cmd.name] = new Date()
      }
    }
    resolve(isAllowResult)
  })
}
