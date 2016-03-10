var ConfigFile = require("../config.json"),
  Datastore = require('nedb'),
  Logger = require("./logger.js").Logger;

var db = new Datastore({
  filename: './runtime/databases/permissionstorage',
  autoload: true
});

exports.GetLevel = function(server, user, callback) {
  if (ConfigFile.permissions.masterUser.indexOf(user) > -1) {
    return callback(null, 9);
  }
  if (ConfigFile.permissions.level1.indexOf(user) > -1) {
    return callback(null, 1);
  }
  if (ConfigFile.permissions.level2.indexOf(user) > -1) {
    return callback(null, 2);
  }
  if (ConfigFile.permissions.level3.indexOf(user) > -1) {
    return callback(null, 3);
  }
  if (server === null) {
    return callback(null, 0);
  }
  db.find({
    _id: server.id
  }, function(err, result) {
    if (err) {
      return callback(err, -1);
    }
    if (!result) {
      return callback('notFound', -1);
    } else {
      if (result[0].superUser === user) {
        return callback(null, 4);
      } else if (result[0].permissions.level1.indexOf(user) > -1) {
        return callback(null, 1);
      } else if (result[0].permissions.level2.indexOf(user) > -1) {
        return callback(null, 2);
      } else if (result[0].permissions.level3.indexOf(user) > -1) {
        return callback(null, 3);
      } else {
        return callback(null, 0); // Nothing is found, so the user must have no permissions set
      }
    }
  });
};

exports.GetNSFW = function(server, channel, callback) {
  db.find({
    _id: server.id
  }, function(err, result) {
    if (err) {
      return callback(err, -1);
    }
    if (!result) {
      return callback('notFound', -1);
    } else {
      if (result[0].nsfw_permissions.allowed.indexOf(channel) > -1) {
        return callback(null, 'on');
      } else {
        return callback(null, 'off');
      }
    }
  });
};

exports.SetLevel = function(server, user, level, callback) {
  // Fetch the server document first
  db.find({
    _id: server.id
  }, function(err, result) {
    if (err) {
      return callback(err, -1);
    }
    if (!result) {
      return callback('notFound', -1);
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
          }, {}, function() {
            // ...and replace it with the new one
            if (level === 0) {
              // The user's permission is already removed, so we can exit the function
              return callback(null , 0);
            }
            if (level === 1) {
              db.update({
                _id: server.id
              }, {
                $push: {
                  'permissions.level1': user
                }
              }, {}, function() {
                return callback(null, 1);
              });
            } else if (level === 2) {
              db.update({
                _id: server.id
              }, {
                $push: {
                  'permissions.level2': user
                }
              }, {}, function() {
                return callback(null, 2);
              });
            } else if (level === 3) {
              db.update({
                _id: server.id
              }, {
                $push: {
                  'permissions.level3': user
                }
              }, {}, function() {
                return callback(null, 3);
              });
            }
          });
        } else {
          // If no permission is present, just insert the level into the database
          if (level === 1) {
            db.update({
              _id: server.id
            }, {
              $push: {
                'permissions.level1': user
              }
            }, {}, function() {
              return callback(null, 1);
            });
          } else if (level === 2) {
            db.update({
              _id: server.id
            }, {
              $push: {
                'permissions.level2': user
              }
            }, {}, function() {
              return callback(null, 2);
            });
          } else if (level === 3) {
            db.update({
              _id: server.id
            }, {
              $push: {
                'permissions.level3': user
              }
            }, {}, function() {
              return callback(null, 3);
            });
          }
        }
      } else {
        // The level is not supported by the databse, return an error and abort execution
        return callback('notSupported', -1);
      }
    }
  });
};

exports.SetNSFW = function(server, channel, allow, callback) {
  db.find({
    _id: server.id
  }, function(err, result) {
    if (err) {
      return callback(err, -1);
    }
    if (!result) {
      return callback('notFound', -1);
    } else {
      if (allow === 'off') {
        db.update({
          _id: server.id
        }, {
          $pull: {
            'nsfw_permissions.allowed': channel
          }
        }, {}, function(){
          return callback(null, 'off');
        });
      } else if (allow === 'on') {
        db.update({
          _id: server.id
        }, {
          $push: {
            'nsfw_permissions.allowed': channel
          }
        }, {}, function() {
          return callback(null, 'on');
        });
      }
    }
  });
};

exports.initializeServer = function(server, callback) {
  // The NaN values are acting as placeholders
  var doc = {
    _id: server.id,
    superUser: server.owner.id,
    blacklists: {
      users: ["NaN"],
      commands: ["NaN"],
      channels: ["NaN"]
    },
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
      return callback(err, -1);
    } else if (result) {
      return callback(null, 0);
    }
  });
};
