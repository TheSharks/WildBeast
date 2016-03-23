var ConfigFile = require("../config.json"),
  Datastore = require('nedb'),
  Logger = require("./logger.js").Logger;

var db = new Datastore({
  filename: './runtime/databases/customizationstore',
  autoload: true
});

db.persistence.setAutocompactionInterval(30000);

exports.checkWelcoming = function(server) {
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
          if (result[0].settings.welcoming === true) {
            resolve(result[0].responses.welcome_message);
          } else {
            return reject('Welcoming turned off.');
          }
        }
      });
    } catch (e) {
      reject(e);
    }
  });
};

exports.replyCheck = function(what, server) {
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
          if (what === 'no_permission_response') {
            resolve(result[0].responses.no_permission_response);
          } else if (what === 'nsfw_disallowed_response') {
            resolve(result[0].responses.nsfw_disallowed_response);
          } else if (what === 'not_usable_response') {
            resolve(result[0].responses.not_usable_response);
          }
        }
      });
    } catch (e) {
      reject(e);
    }
  });
};

exports.handle = function(what, server) {
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
          var what1 = what.split(' ');
          if (what1[0] === 'welcome_message') {
            var what2 = what1.slice(1, what1.length);
            db.update({
              _id: server.id
            }, {
              $set: {
                'responses.welcome_message': what2.join(' ')
              }
            }, {}, function() {
              resolve('Success.');
            });
          } else if (what1[0] === 'no_permission_response') {
            var what2 = what1.slice(1, what1.length);
            db.update({
              _id: server.id
            }, {
              $set: {
                'responses.no_permission_response': what2.join(' ')
              }
            }, {}, function() {
              resolve('Success.');
            });
          } else if (what1[0] === 'nsfw_disallowed_response') {
            var what2 = what1.slice(1, what1.length);
            db.update({
              _id: server.id
            }, {
              $set: {
                'responses.nsfw_disallowed_response': what2.join(' ')
              }
            }, {}, function() {
              resolve('Success.');
            });
          } else if (what1[0] === 'not_usable_response') {
            var what2 = what1.slice(1, what1.length);
            db.update({
              _id: server.id
            }, {
              $set: {
                'responses.not_usable_response': what2.join(' ')
              }
            }, {}, function() {
              resolve('Success.');
            });
          } else if (what1[0] === 'welcoming') {
            if (what1[1] === 'off') {
              db.update({
                _id: server.id
              }, {
                $set: {
                  'settings.welcoming': false
                }
              }, {}, function() {
                resolve('Success.');
              });
            }
            if (what1[1] === 'on') {
              db.update({
                _id: server.id
              }, {
                $set: {
                  'settings.welcoming': true
                }
              }, {}, function() {
                resolve('Success.');
              });
            }
          } else {
            return reject('Not supported!');
          }
        }
      });
    } catch (e) {
      reject(e);
    }
  });
};

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

exports.initializeServer = function(server) {
  var doc = {
    _id: server.id,
    responses: {
      welcome_message: 'default',
      no_permission_response: 'default',
      nsfw_disallowed_response: 'default'
    },
    settings: {
      welcoming: false
    }
  };
  try {
    db.insert(doc);
  } catch (e) {
    Logger.warn('Server initializing failed! ' + e);
  }
};
