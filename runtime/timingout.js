var LevelUP = require("levelup"),
    Logger = require("./logger.js").Logger;
var db = LevelUP('./runtime/databases/discord_timeouts');

exports.timeoutCheck = function(command, channel, callback){
  var d = new Date(),
  CurrentTime = Date.UTC();
  db.get("timeout_till:" + command + channel , function(err, value) {
    if (err){
      if (err.notFound) {
        callback(null, "no"); // Return 0 if no value present in LevelUP
        return;
      } else {
      Logger.error("LevelUP error! " + err);
      return callback(err, -1);
    }} else if (value < CurrentTime){
      db.del("timeout_till:" + command + channel, function(err){
        if (err){
          Logger.error("LevelUP error! " + err);
        } else {
          return callback(null, "yes");
    }});
    } else {
      return callback(null, "no");
    }
  });
};

exports.timeoutSet = function(command, channel, timeout, callback){
  var till = (Date.UTC() + (timeout * 1000));
  db.put("timeout_till:" + command + channel, till, function(err) {
    if (err){
      Logger.error("LevelUP error! " + err);
      return callback(err, -1);
    } else {
      return callback(null, "okay");
    }
  });
};
