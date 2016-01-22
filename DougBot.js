// DougBot 2.0 beta
// Define variables first
var Discord = require("discord.js");
var bot = new Discord.Client();
var ConfigFile = require("./config.json");
var Logger = require("./runtime/logger.js").Logger;
var DebugLogger = require("./runtime/logger.js").DebugModeLog;
var VerboseLogger = require("./runtime/logger.js").VerboseModeLog;
var ChatLogger = require("./runtime/logger.js").ChatLog;
var Commands = require("./runtime/commands.js").Commands;
var Permissions = require("./runtime/permissions.js");
var VersionChecker = require("./runtime/versionchecker.js");
var forever = require("forever");
var DebugMode;
var VerboseLog;
var aliases;
var Defaulting = require("./runtime/serverdefaulting.js");
var TimeOut = require("./runtime/timingout.js");

// Declare aliasses
try{
	aliases = require("./runtime/alias.json");
} catch(e) {
	//No aliases defined
	aliases = {};
}

// Declare if debug mode or verbose logging is needed
if (ConfigFile.bot_settings.debug_mode === true) {
  DebugMode = true;
  console.log("WARNING! Debug mode activated! Only use this if you're sure what you're doing!");
  console.log("WARNING! Debug mode log may contain sensitive information, only share it with trustworthy people!.");
  DebugLogger.debug("DEBUG MODE LOG: Debug mode has been enabled.");
  DebugLogger.debug("DEBUG MODE LOG: WARNING! This log may contain sensitive information, only share it with trustworthy people!.");
  DebugLogger.debug("DEBUG MODE LOG: Configuration information");
  DebugLogger.debug("DEBUG MODE LOG: Master user: " + ConfigFile.permissions.masterUser);
  DebugLogger.debug("DEBUG MODE LOG: Level 1 user: " + ConfigFile.permissions.level1);
  DebugLogger.debug("DEBUG MODE LOG: Level 2 user: " + ConfigFile.permissions.level2);
  DebugLogger.debug("DEBUG MODE LOG: Level 3 user: " + ConfigFile.permissions.level3);
  DebugLogger.debug("DEBUG MODE LOG: Help mode: " + ConfigFile.bot_settings.help_mode);
  DebugLogger.debug("DEBUG MODE LOG: Command prefix: " + ConfigFile.bot_settings.cmd_prefix);
  DebugLogger.debug("DEBUG MODE LOG: Auto-Restart: " + ConfigFile.bot_settings.auto_restart);
  if (ConfigFile.redis.host && ConfigFile.redis.port) {
    DebugLogger.debug("DEBUG MODE LOG: Redis host: " + ConfigFile.redis.host);
    DebugLogger.debug("DEBUG MODE LOG: Redis port: " + ConfigFile.redis.port);
  } else if (ConfigFile.redis.url) {
    DebugLogger.debug("DEBUG MODE LOG: Redis URL: " + ConfigFile.redis.url);
  } else {
    DebugLogger.debug("DEBUG MODE LOG: Invalid Redis configuration detected!");
  }
  DebugLogger.debug("DEBUG MODE LOG: End of configuration information.");
} else {
  DebugMode = false;
}

if (ConfigFile.bot_settings.verbose_logging === true) {
  VerboseLog = true;
  console.log("WARNING! Verbose logging activated! Only use this if you're sure what you're doing!");
} else {
  VerboseLog = false;
}

// Error logger
bot.on("error", function(error) {
  Logger.error("Encounterd an error, please report this to the author of this bot, include any log files present in the logs folder.");
  if (DebugMode === true) {
    DebugLogger.debug("DEBUG MODE LOG: Encountered an error with discord.js most likely, got error: " + error);
  }
});

// Ready announcment
bot.on("ready", function() {
  if (DebugMode === true) {
    DebugLogger.debug("DEBUG MODE LOG: Ready event fired.");
  }
  if (bot.servers.length === 0) {
    Logger.warn("No servers deteted, creating default server.");
    Defaulting.create(bot);
  }
  Logger.info("Joining pre-defined servers...");
  for (var index in ConfigFile.join_on_launch) {
    bot.joinServer(ConfigFile.join_on_launch[index], function(error, server) {
      if (error) {
        Logger.warn("Couldn't join a server (" + error + ")");
      }
      if (server) {
        Logger.info("Joined " + server.name);
      }
    });
  }
  Logger.info("Ready to start!");
  Logger.info("Logged in as " + bot.user.username + ".");
  Logger.info("Serving " + bot.users.length + " users, in " + bot.servers.length + " servers.");
});

// Disconnected announcment
bot.on("disconnected", function() {
  if (DebugMode === true) {
    DebugLogger.debug("DEBUG MODE LOG: Disconnected from Discord.");
  }
  Logger.warn("Disconnected, if this wasn't a connection issue or on purpose, report this issue to the author of the bot.");
  process.exit(0); // Disconnected announcments are not always an error, seeing that disconnections can be triggered by the user.
});

// Command checker
bot.on("message", function(msg) {
  if (ConfigFile.bot_settings.log_chat === true && msg.channel.server) {
    var d = new Date();
    var n = d.toUTCString();
    ChatLogger.info(n + ": " + msg.channel.server.name + ", " + msg.channel.name + ": " + msg.author.username + " said <" + msg + ">");
  }
  if (msg.author.equals(bot.user)) {
    return;
  }
  var prefix;
  if (ConfigFile.bot_settings.cmd_prefix != "mention") {
    prefix = ConfigFile.bot_settings.cmd_prefix;
  } else if (ConfigFile.bot_settings.cmd_prefix === "mention") {
    prefix = bot.user + " ";
  } else {
    if (DebugMode === true) {
      DebugLogger.debug("DEBUG MODE LOG: Weird prefix detected.");
    }
  }
  if (msg.content.indexOf(prefix) === 0) {
    Logger.info("Executing <" + msg.content + "> from " + msg.author.username);
    var step = msg.content.substr(prefix.length);
    var chunks = step.split(" ");
    var command = chunks[0];
    alias = aliases[command];
    var suffix = msg.content.substring(command.length + (prefix.length + 1));
    if(alias){
      command = alias[0];
      suffix = alias[1] + " " + suffix;
    }
    if (command === "help") {
      Commands.help.fn(bot, msg, suffix);
      return;
    }
    if (Commands[command]) {
      if (DebugMode === true) {
        DebugLogger.debug("DEBUG MODE LOG: Command detected.");
      }
      if (msg.channel.server) {
        Permissions.GetLevel((msg.channel.server.id + msg.author.id), msg.author.id, function(err, level) {
          if (err) {
            if (DebugMode === true) {
              DebugLogger.debug("DEBUG MODE LOG: GetLevel failed, got error: " + err);
            }
            Logger.debug("An error occured!");
            return;
          }
          if (level >= Commands[command].level) {
            if (DebugMode === true) {
              DebugLogger.debug("DEBUG MODE LOG: Execution of command allowed.");
            }
            if (Commands[command].timeout) {
              TimeOut.timeoutCheck(command, msg.channel.server.id, function(reply) {
                if (reply === "yes") {
                  bot.sendMessage(msg.channel, "Sorry, this command is on cooldown.");
                  return;
                }
              });
            }
            if (!Commands[command].nsfw) {
              if (DebugMode === true) {
                DebugLogger.debug("DEBUG MODE LOG: Safe for work command executed.");
              }
              Commands[command].fn(bot, msg, suffix);
              if (Commands[command].timeout) {
                TimeOut.timeoutSet(command, msg.channel.server.id, Commands[command].timeout, function(reply, err) {
                  if (err) {
                    Logger.error("Resetting timeout failed!");
                  }
                });
              }
              return;
            } else {
              Permissions.GetNSFW(msg.channel, function(err, reply) {
                if (DebugMode === true) {
                  DebugLogger.debug("DEBUG MODE LOG: Command is NSFW, checking if channel allows that.");
                }
                if (err) {
                  Logger.debug("Got an error! <" + err + ">");
                  if (DebugMode === true) {
                    DebugLogger.debug("DEBUG MODE LOG: NSFW channel check failed, got error: " + err);
                  }
                  bot.sendMessage(msg.channel, "Sorry, an error occured, try again later.");
                  return;
                }
                if (reply === "on") {
                  if (DebugMode === true) {
                    DebugLogger.debug("DEBUG MODE LOG: NSFW command successfully executed.");
                  }
                  Commands[command].fn(bot, msg, suffix);
                  return;
                } else {
                  if (DebugMode === true) {
                    DebugLogger.debug("DEBUG MODE LOG: NSFW command execution failed because of channel settings.");
                  }
                  bot.sendMessage(msg.channel, "You cannot use NSFW commands in this channel!");
                }
              });
            }
          } else {
            if (DebugMode === true) {
              DebugLogger.debug("DEBUG MODE LOG: User has no permission to use that command.");
            }
            bot.sendMessage(msg.channel, "You don't have permission to use this command!");
            return;
          }
        });
      } else {
        Permissions.GetLevel(0, msg.author.id, function(err, level) { // Value of 0 is acting as a placeholder, because in DM's only global permissions apply.
          if (DebugMode === true) {
            DebugLogger.debug("DEBUG MODE LOG: DM command detected, getting global perms.");
          }
          if (err) {
            Logger.debug("An error occured!");
            if (DebugMode === true) {
              DebugLogger.debug("DEBUG MODE LOG: GetLevel failed, got error: " + err);
            }
            return;
          }
          if (level >= Commands[command].level) {
            if (DebugMode === true) {
              DebugLogger.debug("DEBUG MODE LOG: User has sufficient global perms.");
            }
            Commands[command].fn(bot, msg, suffix);
            return;
          } else {
            if (DebugMode === true) {
              DebugLogger.debug("DEBUG MODE LOG: User does not have enough global permissions.");
            }
            bot.sendMessage(msg.channel, "Only global permissions apply in DM's, your server specific permissions do nothing here!");
          }
        });
      }
    }
  }
});

// Initial functions
function init(token) {
  if (DebugMode === true) {
    DebugLogger.debug("DEBUG MODE LOG: Sucessfully logged into Discord, returned token: " + token);
    DebugLogger.debug("DEBUG MODE LOG: Continuing start-up sequence.");
  }
  Logger.info("Loading WildBeast...");
  Logger.info("Checking for updates...");
  VersionChecker.getStatus(function(err, status) {
    if (err) {
      Logger.error(err);
      if (DebugMode === true) {
        DebugLogger.debug("DEBUG MODE LOG: Version checking failed, got error: " + err);
      }
    } // error handle
    if (status && status !== "failed") {
      Logger.info(status);
    }
  });
}

function err(error) {
  if (DebugMode === true) {
    DebugLogger.debug("DEBUG MODE LOG: Logging into Discord probably failed, got error: " + error);
  }
}

process.on("beforeExit", function() {
  Logger.info("About to exit Node!");
  if (ConfigFile.bot_settings.auto_restart === true) {
    Logger.info("Auto restart initiated...");
    forever.start("-m 1 DougBot.js");
  }
});
// Connection starter
bot.login(ConfigFile.discord.email, ConfigFile.discord.password).then(init).catch(err);
