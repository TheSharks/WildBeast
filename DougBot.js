// DougBot 2.0 alpha

// Define variables first
var Discord = require("discord.js");
var bot = new Discord.Client();
var ConfigFile = require("./config.json");
var Logger = require("./runtime/logger.js").Logger;
var ChatLogger = require("./runtime/logger.js").ChatLog;
var Commands = require("./runtime/commands.js").Commands;
var VersionChecker = require("./runtime/versionchecker.js");
var mainenance;

// Error logger
bot.on("error", function(error){
  Logger.log("debug", "Got an error: " + error);
  Logger.log("warn", "Encounterd an error, please report this to the author of this bot, include any log files present in the logs folder.");
});

// Ready announcment
bot.on("ready", function(){
  Logger.log("info", "Connected, logged in as " + bot.user.username + ", and serving " + bot.users.length + " users.");
});

// Disconnected announcment
bot.on("disconnected", function(){
  Logger.log("warn", "Disconnected, if this wasn't a connection issue or on purpose, report this issue to the author of the bot.");
});

// Command checker
bot.on("message", function(msg){
  if(ConfigFile.log_chat === true){
    var d = new Date();
    var n = d.toUTCString();
    ChatLogger.log("info", n + ": " + msg.channel.server.name + ", " + msg.channel.name + ": " + msg.author.username + " said <" + msg + ">");
  }
  if(msg.author.equals(bot.user)) { return; }
  if(msg.content.charAt(0) === ConfigFile.cmd_prefix) {
    Logger.log("info", "Executing <" + msg.content + "> from " + msg.author.username);
    msg.content = msg.content.substr(1);
    var chunks = msg.content.split(" ");
    var command = chunks[0];
    var suffix = msg.content.substring(command.length + 2);
    if (Commands[command]) {
      Commands[command].fn(bot, msg, suffix);
    } else { return; }
  } else { return; }
});

// Version checker
function init() {
	Logger.info("Initializing...");
	Logger.info("Checking for updates...");
	VersionChecker.getStatus(function(err, status) {
		if (err) { error(err); } // error handle
		if (status && status !== "failed") {
			Logger.info(status);
		}
	});
}

// Connection starter
bot.login(ConfigFile.email, ConfigFile.password).then(init);
