var Discord = require("discord.js"),
  bot = new Discord.Client(),
  ConfigFile = require("../config.json"),
  Logger = require("./logger.js").Logger,
  DebugLogger = require("./logger.js").DebugModeLog,
  LogBookID,
  ServerID;

exports.create = function(bot) {
  Logger.info("Creating default server...");
  bot.createServer(bot.user.username + " Base Camp", "london", function(error, server) {
    if (server) {
      Logger.info("Default server sucessfully created.");
      var msgArray = [];
      msgArray.push("Hello! My name is " + bot.user.username + ", welcome to my base camp!");
      msgArray.push("With this server, you can monitor and contol the bot.");
      msgArray.push("`leave` will not function in this server, as I'm the owner of this server, so be assured that I'll always be in at least 1 server.");
      msgArray.push("There are some special commands that only work in this server, `adminme` for example if you're my master."); // TODO: Not yet actually, I haven't done that yet.
      msgArray.push("Thanks for choosing WildBeast as your framework, have fun!");
      bot.sendMessage(server.defaultChannel, msgArray);
      var step = ConfigFile.default_server.print_to_which_channel.split(" ");
      bot.createChannel(server, step.join("-"), function(channel, error) {
        if (channel) {
          Logger.info("Logbook channel sucessfully created.");
          LogBookID = channel.id;
        } else if (error) {
          Logger.error("Creating the logbook channel failed, got error: " + error);
        }
      });
      bot.createInvite(server.defaultChannel, function(error, invite) {
        if (invite) {
          Logger.info("Default server sucessfully created, invite: " + invite);
        } else if (error) {
          Logger.error("Creating the invite for the default server failed, try manually making an invite via my account, got error: " + error);
        }
      });
    } else if (error) {
      Logger.error("Creating the default server failed, got error: " + error);
    }
  });
};

exports.logbook = function(entry, user, server) {
  Logger.info("About to log something to the logbook: " + entry);
  var msgArray = [];
  msgArray.push("New logbook entry:");
  msgArray.push("```" + entry + "```");
  msgArray.push("Triggered by " + user + " in server " + server);
  bot.sendMessage(LogBookID, msgArray);
};

exports.fetch = function(callback) { // TODO: This is the most ridicolous method to fetch this, change to a more sensible method.
  callback(ServerID);
};

exports.setServer = function(id) {
  ServerID = id;
};

exports.setChannel = function(id) {
  LogBookID = id;
};
exports.check = function(callback) { // TODO: Make more reliable, meant to fetch servers in which bot is the owner
  var oldServers = [];
  for (var owner in bot.servers) {
    oldServers[owner] = bot.servers[owner];
    if (oldServers.indexOf(bot.user) !== -1) {
      return callback(true);
    } else {
      return callback(false);
    }
  }
};
