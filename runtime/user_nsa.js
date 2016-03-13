// This is for namechange tracking

var ConfigFile = require("../config.json"),
  Datastore = require('nedb'),
  Logger = require("./logger.js").Logger;

var db = new Datastore({
  filename: './runtime/databases/user_nsastore',
  autoload: true
});

exports.trackNewUser = function(user) { // Most of the time, this function does not need to be called directly, the script will auto-track users
  var doc = {
    _id: user.id,
    known_names: [user.username],
    user_is_blacklisted: false,
    user_is_vip: false
  };
  db.insert(doc, function(err, result) {
    if (err) {
      Logger.error('Error making user document! ' + err);
    } else if (result) {
      Logger.debug('Sucess making an UserDB doc');
    }
  });
};

exports.checkUserBlacklists = function(user, callback) {
  db.find({
    _id: user.id
  }, function(err, result) {
    if (err) {
      Logger.error('Error checking user knowledge! ' + err);
    }
    if (!result) {
      return callback('notFound', -1);
    } else {
      if (result[0].user_is_blacklisted === true) {
        return callback(null, 1);
      } else {
        return callback(null, 0);
      }
    }
  });
};

exports.handleNamechange = function(user) {
  db.update({
    _id: user.id
  }, {
    $push: {
      known_names: user.username
    }
  }, {});
};

exports.checkIfKnown = function(user) {
  db.find({
    _id: user.id
  }, function(err, result) {
    if (err) {
      Logger.error('Error checking user knowledge! ' + err);
    }
    if (!result) {
      this.trackNewUser(user);
    } else {
      return; // User is known, so exit the function
    }
  });
};
