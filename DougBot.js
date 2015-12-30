// DougBot 2.0 alpha
// Define variables first
var Discord = require("discord.js");
var bot = new Discord.Client();
var ConfigFile = require("./config.json");
var Logger = require("./runtime/logger.js").Logger;
var ChatLogger = require("./runtime/logger.js").ChatLog;
var Commands = require("./runtime/commands.js").Commands;
var Permissions = require("./runtime/permissions.js");
var VersionChecker = require("./runtime/versionchecker.js");
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
      Permissions.GetLevel((msg.author.id + msg.channel.server.id), msg.author.id, function (err, level){
        if (err){
          Logger.debug("An error occured!");
          return;
        }
        if (level >= Commands[command].level){
          if (!Commands[command].nsfw || !msg.channel.server){
            Commands[command].fn(bot, msg, suffix);
            return;
          } else {
            Permissions.GetNSFW(msg.channel, function (err, reply){
              if (err){
                Logger.debug("Got an error! <" + err + ">");
                bot.sendMessage(msg.channel, "Sorry, an error occured, try again later.");
                return;
              }
              if (reply === "on"){
                Commands[command].fn(bot, msg, suffix);
                return;
              } else {
                bot.sendMessage(msg.channel, "You cannot use NSFW commands in this channel!");
          }});}
        } else {
              bot.sendMessage(msg.channel, "You don't have permission to use this command!");
              return;
            }
          });
        }
      }
});

// Initial functions
function init() {
  Logger.info("Loading DougleyBot...");
  Logger.info("Checking for updates...");
  VersionChecker.getStatus(function(err, status) {
    if (err) {
      Logger.error(err);
    } // error handle
    if (status && status !== "failed") {
      Logger.info(status);
    }
  });
}
// Connection starter
bot.login(ConfigFile.email, ConfigFile.password).then(init);
