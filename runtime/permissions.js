var ConfigFile = require("../config.json");
var Redis = require("redis");
var Logger = require("./logger.js").Logger;

var RedisServer = Redis.createClient(ConfigFile.redis.port, ConfigFile.redis.host);

exports.GetLevel = function(server, user, callback){
  if (user === ConfigFile.masterUser){
    return callback (null, 10); // Return a massive value if the user is the master user
  }
  if (user == ConfigFile.permissions.level1){
    return callback (null, 1); // Hardcoded reply if user has a global permission
  }
  if (user == ConfigFile.permissions.level2){
    return callback (null, 2); // Hardcoded reply if user has a global permission
  }
  if (user == ConfigFile.permissions.level3){
    return callback (null, 3); // Hardcoded reply if user has a global permission
  }
  // Else, connect to the Redis server and fetch the user level
  RedisServer.get("auth_level:" + server + ", " + user, function(err, reply) {
		if (err) {
      return callback(err, -1);
    }
		if (reply) {
			return callback(null, parseInt(reply));
		} else {
			callback(null, 0); // Return 0 if no value present in Redis
		}
	});
};

exports.GetNSFW = function(channel, callback){
  RedisServer.get("auth_nsfw:" + channel.id, function(err, reply) {
    if (err) {
      return callback(err, -1);
    }
    if (reply) {
      return callback(null, reply);
    } else {
      callback(null, "off");
    }
  });
};

exports.SetLevel = function(server, user, level, callback){
  RedisServer.set("auth_level:" + server + ", " + user, parseInt(level), function(err, reply) {
    if (err) {
      callback(err, -1);
    }
    if (reply) {
      callback(null, parseInt(level));
    } else {
      return callback(null, 0);
    }
  });
};

exports.MakeStorage = function(server, callback){
  // This function makes all server founders level 3 for their server
  var CurrentServers = [];
  	for (var index in bot.servers) {
  		CurrentServers[index] = bot.servers[index];
    }
    for (server in CurrentServers){
      SetLevel(server.id, server.owner.id, 3, function(err, reply) {
        if (err){
          Logger.error("An error occured during storage making!");
          return callback(err, -1);
        } else {
          return callback(null, 0);
        }
    }
  );}
};

exports.SetNSFW = function(channel, allow, callback){
	RedisServer.set("auth_nsfw:" + channel.id, allow, function(err, reply) {
		if (err) {
      callback(err, -1);
    }
		if (reply) {
			callback(null, allow);
		} else {
			return callback(null, null);
		}
	});
};
