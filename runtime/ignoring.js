 var LevelUP = require("levelup"),
Logger = require("./logger.js").Logger;

var db = LevelUP('./runtime/databases/discord_ignoring');

exports.checkIgnored = function(sum, callback) {
  db.get("ignored:" + sum, function(err, value) {
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
      return callback(null, 1);
    }
  });
};

exports.checkGlobalIgnored = function(user, callback) {
  db.get("globalignore:" + user, function(err, value) {
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
      return callback(null, 1);
    }
  });
};

exports.makeIgnored = function(sum, callback) {
  db.put("ignored:" + sum, function(err) {
    if (err) {
      Logger.error("LevelUP error! " + err);
      callback(err, -1);
    }
    if (!err) {
      callback(null, 1);
    }
  });
};

exports.makeGlobalIgnored = function(user, callback) {
  db.put("globalignore:" + user, function(err){
    if (err){
      Logger.error("LevelUP error! " + err);
      callback(err, -1);
    }
    if (!err) {
      callback(null, 1);
    }
  });
};

exports.makeUnignored = function(sum, callback) {
  db.del("ignored:" + sum, function(err) {
    if (err){
      Logger.error("LevelUP error! " + err);
      callback(err, -1);
    }
    if (!err) {
      callback(null, 0);
    }
  });
};


exports.unignoreGlobal = function(user) {
  db.del("globalignore:" + user, function(err, callback) {
    if (err){
      Logger.error("LevelUP error! " + err);
      callback(err, -1);
    }
    if (!err) {
      callback(null, 0);
    }
  });
};
