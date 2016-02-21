var LevelUP = require("levelup"),
  Logger = require("./logger.js").Logger;

var db = LevelUP('./runtime/databases/beastbank');
// 1 general error
// 2 low on cash
// 3 already exists
// 4 not found

fetchSaldo = function(user, callback) {
  db.get(user, function(err, reply) {
    if (err) {
      if (err.notFound) {
        return callback(4, null);
      } else {
        return callback(err, null);
      }
    }
    if (reply && !err) {
      return callback(null, reply);
    }
  });
};

exports.credit = function(user, cash, callback) {
  fetchSaldo(user, function(err, reply) {
    if (reply) {
      db.del(user, function(err) {
        if (err) {
          return callback(err, null);
        } else if (!err) {
          db.put(user + ":" + reply + cash, function(err) {
            if (err) {
              return callback(err, null);
            } else if (!err) {
              return callback(null, Math.round(reply + cash));
            }
          });
        }
      });
    }
    if (err) return callback(err, null);
  });
};

exports.debit = function(user, cash, callback) {
  fetchSaldo(user, function(err, reply) {
    if (err) return callback(err, null);
    if (reply < cash) {
      return callback(2, null);
    } else if (reply > cash) {
      db.del(user, function(err){
        if (err) {
          return callback(err, null);
        } else {
          db.put(user + ":" + Math.round(reply - cash), function(err) {
            if (err) {
              return callback(err, null);
            } else {
              return callback(null, Math.round(reply - cash));
            }
          });
        }
      });
    }
  });
};

exports.register = function(user, callback) {
  fetchSaldo(user, function(err, reply) {
    if (reply && !err) return callback(3, null);
    if (err === 4) {
      db.put(user + ':500', function(err) {
        if (!err) return callback(0, 500);
        if (err) return callback(1, null);
      });
    }
  });
};
