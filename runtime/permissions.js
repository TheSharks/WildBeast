var ConfigFile = require("../config.json"),
  Datastore = require('nedb'),
  Logger = require("./logger.js").Logger;

var db = new Datastore({
  filename: './runtime/databases/permissionstorage',
  autoload: true
});

db.persistence.setAutocompactionInterval(30000);

exports.removeServer = function(server) {
  db.remove({
    _id: server.id
  }, {}, function(err, success) {
    if (err) {
      Logger.error('Error removing database document! ' + err);
    } else if (success === 1) {
      Logger.info('Removed database documents.');
    }
  });
};

exports.GetLevel = function(server, user) {
  return new Promise(function(resolve, reject) {
    try {
      if (ConfigFile.permissions.masterUser.indexOf(user) > -1) {
        return resolve(9);
      } else if (ConfigFile.permissions.level1.indexOf(user) > -1) {
        return resolve(1);
      } else if (ConfigFile.permissions.level2.indexOf(user) > -1) {
        return resolve(2);
      } else if (ConfigFile.permissions.level3.indexOf(user) > -1) {
        return resolve(3);
      }
      if (!server) {
        return resolve(0); // Resolve with 0 if no server is present
      }
      db.find({
        _id: server.id
      }, function(err, result) {
        if (err) {
          return reject(err);
        }
        if (result.length === 0) {
          return reject('Nothing found!');
        } else {
          if (result[0].superUser === user) {
            return resolve(4);
          } else if (result[0].permissions.level1.indexOf(user) > -1) {
            return resolve(1);
          } else if (result[0].permissions.level2.indexOf(user) > -1) {
            return resolve(2);
          } else if (result[0].permissions.level3.indexOf(user) > -1) {
            return resolve(3);
          } else {
            return resolve(0); // Nothing is found, so the user must have no permissions set
          }
        }
      });
    } catch (e) {
      reject(e);
    }
  });
};

exports.GetNSFW = function(server, channel) {
  return new Promise(function(resolve, reject) {
    try {
      db.find({
        _id: server.id
      }, function(err, result) {
        if (err) {
          return reject(err);
        }
        if (result.length === 0) {
          return reject('Nothing found!');
        } else {
          if (result[0] === undefined) {
            return reject('Nothing found!');
          }
          if (result[0].nsfw_permissions.allowed.indexOf(channel) > -1) {
            return resolve('on');
          } else {
            return reject('No permission');
          }
        }
      });
    } catch (e) {
      reject(e);
    }
  });
};

exports.SetLevel = function(server, user, level) {
  return new Promise(function(resolve, reject) {
    try {
      // Fetch the server document first
      db.find({
        _id: server.id
      }, function(err, result) {
        if (err) {
          reject(err);
        }
        if (result.length === 0) {
          reject('Nothing found!');
        } else {
          level = parseInt(level);
          // First, check if the level is supported by the database
          if (level === 0 || level === 1 || level === 2 || level === 3) {
            // Check if the user already has a know permission
            if (result[0].permissions.level1.indexOf(user) > -1 || result[0].permissions.level2.indexOf(user) > -1 || result[0].permissions.level3.indexOf(user) > -1) {
              // If so, remove the know permission...
              db.update({
                _id: server.id
              }, {
                $pull: {
                  'permissions.level1': user,
                  'permissions.level2': user,
                  'permissions.level3': user
                }
              }, {});
            }
            // ...and replace it with the new one
            if (level === 0) {
              // The user's permission is already removed, so we can exit the function
              resolve(0);
            }
            if (level === 1) {
              db.update({
                _id: server.id
              }, {
                $push: {
                  'permissions.level1': user
                }
              }, {}, function() {
                resolve(1);
              });
            } else if (level === 2) {
              db.update({
                _id: server.id
              }, {
                $push: {
                  'permissions.level2': user
                }
              }, {}, function() {
                resolve(2);
              });
            } else if (level === 3) {
              db.update({
                _id: server.id
              }, {
                $push: {
                  'permissions.level3': user
                }
              }, {}, function() {
                resolve(3);
              });
            }
          } else {
            // The level is not supported by the databse, return an error and abort execution
            reject('Not supported!');
          }
        }
      });
    } catch (e) {
      reject(e);
    }
  });
};

exports.SetNSFW = function(server, channel, allow) {
  return new Promise(function(resolve, reject) {
    try {
      db.find({
        _id: server.id
      }, function(err, result) {
        if (err) {
          reject(err);
        }
        if (result.length === 0) {
          reject('Nothing found!');
        } else {
          if (result[0] === undefined) {
            reject('Nothing found!');
          }
          if (allow === 'off') {
            db.update({
              _id: server.id
            }, {
              $pull: {
                'nsfw_permissions.allowed': channel
              }
            }, {}, function() {
              resolve('off');
            });
          } else if (allow === 'on') {
            db.update({
              _id: server.id
            }, {
              $push: {
                'nsfw_permissions.allowed': channel
              }
            }, {}, function() {
              resolve('on');
            });
          }
        }
      });
    } catch (e) {
      reject(e);
    }
  });
};

exports.onlySuperBlacklist = function(server, callback) { // Used to make DB docs that only blacklist the server
  var doc = {
    _id: server,
    server_is_blacklisted: true
  };
  db.insert(doc, function(err, result) {
    if (err) {
      Logger.error('Error while initializing server! ' + err);
    } else if (result) {
      Logger.debug('Successfully made a server doc.');
    }
  });
};

exports.initializeServer = function(server) {
  // The NaN values are acting as placeholders
  var doc = {
    _id: server.id,
    server_is_blacklisted: false,
    superUser: server.owner.id,
    permissions: {
      level1: ["NaN"],
      level2: ["NaN"],
      level3: ["NaN"]
    },
    nsfw_permissions: {
      allowed: ["NaN"]
    }
  };
  db.insert(doc, function(err, result) {
    if (err) {
      Logger.error('Error while initializing server! ' + err);
    } else if (result) {
      Logger.debug('Successfully made a server doc.');
    }
  });
};
