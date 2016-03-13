var ConfigFile = require("../config.json"),
  Datastore = require('nedb'),
  Logger = require("./logger.js").Logger;

var db = new Datastore({
  filename: './runtime/databases/customizationstore',
  autoload: true
});

db.persistence.setAutocompactionInterval(30000);

exports.checkWelcoming = function(server, callback) {
  db.find({
    _id: server.id
  }, function(err, result) {
    if (err) {
      return callback(err, null, -1);
    }
    if (!result) {
      return callback('notFound', null, -1);
    } else {
      if (result[0].settings.welcoming === true) {
        return callback(null, result[0].responses.welcome_message, true);
      } else {
        return callback(null, null, false);
      }
    }
  });
};

exports.replyCheck = function(what, server, callback) {
  db.find({
    _id: server.id
  }, function(err, result) {
    if (err) {
      return callback(err, -1);
    }
    if (!result) {
      return callback('notFound', -1);
    } else {
      if (what === 'no_permission_response') {
        return callback(null, result[0].responses.no_permission_response);
      } else if (what === 'nsfw_disallowed_response') {
        return callback(null, result[0].responses.nsfw_disallowed_response);
      } else if (what === 'not_usable_response') {
        return callback(null, result[0].responses.not_usable_response);
      }
    }
  });
};

exports.handle = function(what, server, callback) {
  db.find({
    _id: server.id
  }, function(err, result) {
    if (err) {
      return callback(err, -1);
    }
    if (!result) {
      return callback('notFound', -1);
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
          return callback(null, 1);
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
          return callback(null, 1);
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
          return callback(null, 1);
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
          return callback(null, 1);
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
            return callback(null, 1);
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
            return callback(null, 1);
          });
        }
      } else {
        return callback('notSupported', -1);
      }
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

exports.initializeServer = function(server, callback) {
  var doc = {
    _id: server.id,
    responses: {
      welcome_message: 'default',
      no_permission_response: 'default',
      nsfw_disallowed_response: 'default',
      not_usable_response: 'default'
    },
    settings: {
      welcoming: false
    }
  };
  db.insert(doc);
};
