// This is for namechange tracking

var ConfigFile = require("../config.json"),
  Datastore = require('nedb'),
  Logger = require("./logger.js").Logger;

var db = new Datastore({
  filename: './runtime/databases/user_nsastore',
  autoload: true
});

db.persistence.setAutocompactionInterval(30000);

exports.trackNewUser = function(user) { // Most of the time, this function does not need to be called directly, the script will auto-track users
  var doc = {
    _id: user.id,
    known_names: [user.username],
    user_is_blacklisted: false,
    user_is_vip: false
  };
  db.insert(doc, function(err, result) {
    if (err) {
      Logger.warn('Error making user document! ' + err); // Since the script auto-tracks, errors get too verbose sometimes
    } else if (result) {
      Logger.debug('Sucess making an UserDB doc');
    }
  });
};

exports.handleNamechange = function(user) {
  db.find({
    _id: user.id
  }, function(err, result) {
    if (err) {
      Logger.error('Error handing namechange! ' + err);
    }
    if (result.length === 0) {
      this.trackNewUser(user);
    } else {
      if (result[0] === undefined) {
        this.trackNewUser(user);
        return;
      }
      if (result[0].known_names.length > 20) {
        db.update({
          _id: user.id
        }, {
          $pop: {
            known_names: 1
          }
        }, {});
      }
    }
  });
  db.update({
    _id: user.id
  }, {
    $push: {
      known_names: user.username
    }
  }, {});
};

exports.returnNamechanges = function(user) {
  return new Promise(function(resolve, reject) {
    try {
      db.find({
        _id: user.id
      }, function(err, result) {
        if (err) {
          return reject(err);
        }
        if (result) {
          if (result.length === 0) {
            return reject('Nothing found!');
          }
          if (result[0].known_names.length > 1) {
            resolve(result[0].known_names);
          } else {
            return reject('No changes found!');
          }
        }
      });
    } catch (e) {
      reject(e);
    }
  });
};

exports.checkIfKnown = function(user) {
  return new Promise(function(resolve, reject) {
    try {
      db.find({
        _id: user.id
      }, function(err, res) {
        if (err) {
          return reject(err);
        }
        if (res.length === 0) {
          return reject('Nothing found!');
        } else {
          resolve('This user is known to the database.');
        }
      });
    } catch (e) {
      reject(e);
    }
  });
};
