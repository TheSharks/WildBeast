var ConfigFile = require("../config.json"),
  LevelUP = require("levelup"),
  Logger = require("./logger.js").Logger;

var db = LevelUP('./runtime/databases/discord_permissions');

exports.GetLevel = function(sum, user, callback) {
  if (ConfigFile.permissions.masterUser.indexOf(user) > -1) {
    return callback(null, 9); // Return a massive value if the user is the master user
  }
  if (ConfigFile.permissions.level1.indexOf(user) > -1) {
    return callback(null, 1); // Hardcoded reply if user has a global permission
  }
  if (ConfigFile.permissions.level2.indexOf(user) > -1) {
    return callback(null, 2); // Hardcoded reply if user has a global permission
  }
  if (ConfigFile.permissions.level3.indexOf(user) > -1) {
    return callback(null, 3); // Hardcoded reply if user has a global permission
  }
  // Else, connect to LevelUP and fetch the user level
  db.get("auth_level:" + sum, function(err, value) {
    if (err) {
      if (err.notFound) {
        callback(null, 0); // Return 0 if no value present in LevelUP
        return;
      } else {
        Logger.error("LevelUP error! " + err);
        callback(err, -1);
      }
    }
    if (value) {
      return callback(null, parseInt(value));
    }
  });
};

exports.GetNSFW = function(channel, callback) {
  db.get("auth_nsfw:" + channel, function(err, value) {
    if (err) {
      if (err.notFound) {
        callback(null, "off"); // Return 0 if no value present in LevelUP
        return;
      } else {
        Logger.error("LevelUP error! " + err);
        callback(err, -1);
      }
    }
    if (value) {
      return callback(null, value);
    }
  });
};

exports.SetLevel = function(sum, level, callback) {
  db.put("auth_level:" + sum, parseInt(level), function(err) {
    if (err) {
      Logger.error("LevelUP error! " + err);
      callback(err, -1);
    }
    if (!err) {
      callback(null, parseInt(level));
    }
  });
};

exports.SetNSFW = function(channel, allow, callback) {
  db.put("auth_nsfw:" + channel, allow, function(err) {
    if (err) {
      Logger.error("LevelUP error! " + err);
      callback(err, -1);
    }
    if (!err) {
      callback(null, allow);
    }
  });
};
