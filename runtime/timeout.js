var cmdLastExecutedTime = {};

exports.check = function(cmd, server) {
  return new Promise(function(resolve, reject) {
    var isAllowResult = true;
    if (cmd.hasOwnProperty("timeout")) {
      if (cmdLastExecutedTime.hasOwnProperty(server)) {
        if (cmdLastExecutedTime[server].hasOwnProperty(cmd.name)) {
          var currentDateTime = new Date();
          var lastExecutedTime = new Date(cmdLastExecutedTime[server][cmd.name]);
          lastExecutedTime.setSeconds(lastExecutedTime.getSeconds() + cmd.timeout);
          if (currentDateTime < lastExecutedTime) {
            isAllowResult = (lastExecutedTime - currentDateTime) / 1000;
          } else {
            cmdLastExecutedTime[server][cmd.name] = new Date();
          }
        } else {
          cmdLastExecutedTime[server][cmd.name] = new Date();
        }
      } else {
        cmdLastExecutedTime[server] = {};
        cmdLastExecutedTime[server][cmd.name] = new Date();
      }
    }
    resolve(isAllowResult);
  });
};
