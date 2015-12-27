// DougBot 2.0 alpha
// Define variables first
var Discord = require("discord.js");
var bot = new Discord.Client();
var ConfigFile = require("./config.json");
var Logger = require("./runtime/logger.js").Logger;
var ChatLogger = require("./runtime/logger.js").ChatLog;
var Commands = require("./runtime/commands.js").Commands;
var VersionChecker = require("./runtime/versionchecker.js");
var Permissions = require("./runtime/permissions.js");
var isAllowed;
var NSFWAllowed;


// Error logger
bot.on("error", function(error) {
  Logger.debug("Got an error: " + error);
  Logger.error("Encounterd an error, please report this to the author of this bot, include any log files present in the logs folder.");
});

// Ready announcment
bot.on("ready", function() {
  Logger.info("Joining pre-defined servers...");
  for (var index in ConfigFile.join_on_launch){
    bot.joinServer(ConfigFile.join_on_launch[index], function(error, server){
      if (error) {Logger.warn("Couldn't join a server (" + error + ")");}
      if (server) {Logger.info("Joined " + server.name);}
  });}
  Logger.info("Ready to start!");
  Logger.info("Logged in as " + bot.user.username + ".");
  Logger.info("Serving " + bot.users.length + " users, in " + bot.servers.length + " servers.");
});

// Disconnected announcment
bot.on("disconnected", function() {
  Logger.warn("Disconnected, if this wasn't a connection issue or on purpose, report this issue to the author of the bot.");
  process.exit(0); // Disconnected announcments are not always an error, seeing that disconnections can be triggered by the user.
});

// Command checker
bot.on("message", function(msg) {
  if (ConfigFile.log_chat === true && msg.channel.server) {
    var d = new Date();
    var n = d.toUTCString();
    ChatLogger.info(n + ": " + msg.channel.server.name + ", " + msg.channel.name + ": " + msg.author.username + " said <" + msg + ">");
  }
  if (msg.author.equals(bot.user)) {
    return;
  }
  if (msg.content.charAt(0) === ConfigFile.cmd_prefix) {
    Logger.info("Executing <" + msg.content + "> from " + msg.author.username);
    var step = msg.content.substr(1);
    var chunks = step.split(" ");
    var command = chunks[0];
    var suffix = msg.content.substring(command.length + 2);
    if (Commands[command]) {
      var cmd = Commands[command];
      var LevelNeeded = cmd.level;
      Permissions.GetLevel(msg.author.id, function (reply){
        if (reply === LevelNeeded){
          isAllowed = true;
        } else {
          isAllowed = false;
        }
      });
      Permissions.GetNSFW(msg,channel, function (reply){
        if (reply === true){
          NSFWAllowed = true;
        } else {
          NSFWAllowed = false;
        }
      });
      if (isAllowed === true && NSFWAllowed === true){
        Commands[command].fn(bot, msg, suffix);
      }
      if (isAllowed === false){
        Logger.verbose("But the user didn't have enough permissions to do so.");
        bot.sendMessage(msg.channel, "You don't have permission to use this command!");
        return;
      }
      if (NSFWAllowed === false){
        Logger.verbose("But the channel doesn't allow NSFW.");
        bot.sendMessage(msg.channel, "You cannot use NSFW commands in this channel!");
        return;
      }
    } else {
      return;
    }
  } else {
    return;
  }
});

// Initial functions
function init() {
  Logger.verbose("Loading DougleyBot...");
  Logger.verbose("Checking for updates...");
  VersionChecker.getStatus(function(err, status) {
    if (err) {
      Logger.error(err);
    } // error handle
    if (status && status !== "failed") {
      Logger.info(status);
    }
  });
  Logger.verbose("Setting master user...");
    Permissions.SetMaster(function (reply){
      if (reply === ConfigFile.masterUser){
        Logger.info("Success!");
      } else {
        Logger.debug("Something went wrong while setting the master user, expected <" + ConfigFile.masterUser + ">, but got <" + reply + ">.");
        Logger.error("An error occured while setting the master user!");
        process.exit(1);
      }
    });
  Logger.verbose("Setting global permissions...");
    Permissions.SetGlobal(function (reply){
      if (reply === "success"){
        Logger.info("Success!");
      } else {
        Logger.error("An error occured while setting global permissions!");
        process.exit(1);
      }
    });
  Logger.verbose("Creating server permissions storage, this could take a while...");
    Permissons.MakeStorage(function (reply){
      if (reply === "success"){
        Logger.info("Success!");
      } else {
        Logger.error("An error occured while creating server permission storage!");
        process.exit(1);
      }
    });
}

// Connection starter
bot.login(ConfigFile.email, ConfigFile.password).then(init);
