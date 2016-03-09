// DougBot 2.0 beta
// Define variables first
var Discord = require("discord.js"),
  bot = new Discord.Client(),
  pmx = require("pmx"),
  probe = pmx.probe(),
  usercount, channelcount, servercount, comcount, mescount, // PMX vars
  ConfigFile = require("./config.json"),
  Logger = require("./runtime/logger.js").Logger,
  Debug = require("./runtime/debugging.js"),
  ChatLogger = require("./runtime/logger.js").ChatLog,
  Commands = require("./runtime/commands.js").Commands,
  DJ = require("./runtime/djlogic.js"),
  Permissions = require("./runtime/permissions.js"),
  VersionChecker = require("./runtime/versionchecker.js"),
  aliases,
  keymetrics,
  Defaulting = require("./runtime/serverdefaulting.js"),
  TimeOut = require("./runtime/timingout.js"),
  Ignore = require("./runtime/ignoring.js");

// Initial logger saying that script is being loaded.
// Should NOT be placed in init() anymore since that runs after ready
Logger.info("Loading WildBeast...");

// Start debug mode, if needed
Debug.prepareDebug();

// Declare aliasses
try {
  aliases = require("./runtime/alias.json");
} catch (e) {
  //No aliases defined
  aliases = {};
}

// Declare if Keymetrics analytics is needed
if (ConfigFile.bot_settings.keymetrics === true) {
  keymetrics = true;
} else {
  keymetrics = false;
}

// Error logger
bot.on("error", function(error) {
  Logger.error("Encounterd an error, please report this to the author of this bot, include any log files present in the logs folder.");
  Debug.debuglogSomething("Discord.js", "Encountered an error with discord.js most likely, got error: " + error, "error");
});

// Warning logger
bot.on('warn', function(warn) {
  Debug.debuglogSomething('Discord.js', "Encountered a Discord.js warn: " + warn, "warn");
});

// Debug stuff
bot.on('debug', function(debug) {
  Debug.debuglogSomething('Discord.js', "Debug message: " + debug, "debug");
});

// Ready announcment
bot.on("ready", function() {
  Debug.debuglogSomething("Discord", "Ready event fired.", "info");
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
  if (keymetrics === false) return;
  else {
    usercount = probe.metric({
      name: 'Users',
      value: function() {
        return bot.users.length;
      }
    });
    servercount = probe.metric({
      name: 'Servers',
      value: function() {
        return bot.servers.length;
      }
    });
    channelcount = probe.metric({
      name: 'Channels',
      value: function() {
        return bot.channels.length;
      }
    });
    comcount = probe.counter({
      name: 'Commands executed'
    });
    mescount = probe.counter({
      name: 'Messages recieved'
    });
  }
});

// Disconnected announcment
bot.on("disconnected", function() {
  Debug.debuglogSomething("Discord", "Disconnected from Discord.", "warn");
  Logger.warn("Disconnected, if this wasn't a connection issue or on purpose, report this issue to the author of the bot.");
  process.exit(0); // Disconnected announcments are not always an error, seeing that disconnections can be triggered by the user.
});

// Command checker
bot.on("message", function(msg) {
  if (keymetrics === true) mescount.inc();
  if (ConfigFile.bot_settings.log_chat === true && msg.channel.server) {
    var d = new Date();
    var n = d.toUTCString();
    ChatLogger.info(n + ": " + msg.channel.server.name + ", " + msg.channel.name + ": " + msg.author.username + " said <" + msg.cleanContent + ">");
  }
  if (msg.author.equals(bot.user)) {
    return;
  }
  if (msg.channel.isPrivate && msg.content.indexOf("https://discord.gg") === 0) {
    Commands['join-server'].fn(bot, msg, msg.content);
  }
  var prefix;
  if (ConfigFile.bot_settings.cmd_prefix != "mention") {
    prefix = ConfigFile.bot_settings.cmd_prefix;
  } else if (ConfigFile.bot_settings.cmd_prefix === "mention") {
    prefix = bot.user + " ";
  } else {
    Debug.debuglogSomething("DougBot", "Weird prefix detected.", "warn");
  }
  if (msg.content.indexOf(prefix) === 0) {
    if (keymetrics === true) comcount.inc();
    Logger.info("Executing <" + msg.cleanContent + "> from " + msg.author.username);
    var step = msg.content.substr(prefix.length);
    var chunks = step.split(" ");
    var command = chunks[0];
    alias = aliases[command];
    var suffix = msg.content.substring(command.length + (prefix.length + 1));
    if (alias) {
      command = alias[0];
      suffix = alias[1] + " " + suffix;
    }
    if (command === "help") {
      Commands.help.fn(bot, msg, suffix);
      return;
    }
    if (Commands[command]) {
      Debug.debuglogSomething("DougBot", "Command detected, trying to execute.", "info");
      if (Commands[command].music && msg.channel.server) {
        Debug.debuglogSomething("DougBot", "Musical command detected, checking for user role.", "info");
        DJ.checkPerms(msg.channel.server, msg.author, function(err, reply) {
          if (reply === 1 && !err) {
            Commands[command].fn(bot, msg, suffix);
          } else if (reply === 0 && !err) {
            bot.reply(msg, "you need a role called `Radio Master` to use music related commands, even if you're the server owner.");
            return;
          } else if (err) {
            bot.sendMessage(msg.channel, "Something went wrong, try again later.");
            return;
          }
        });
      } else if (Commands[command].music && !msg.channel.server) {
        Debug.debuglogSomething("DougBot", "Musical command detected, but was excuted in a DM.", "info");
        bot.sendMessage(msg.channel, "You cannot use music commands in a DM, dummy!");
        return;
      }
      if (msg.channel.server && !Commands[command].music) {
        Permissions.GetLevel(msg.channel.server, msg.author.id, function(err, level) {
          if (err) {
            Debug.debuglogSomething("NeDB", "GetLevel failed, got error: " + err, "error");
            Logger.debug("An error occured!");
            return;
          }
          if (level >= Commands[command].level) {
            Debug.debuglogSomething("DougBot", "Execution of command allowed.", "info");
            if (Commands[command].timeout) {
              TimeOut.timeoutCheck(command, msg.channel.server.id, function(reply) {
                if (reply === "yes") {
                  Debug.debuglogSomething("DougBot", "Command is on cooldown, execution halted.", "info");
                  bot.sendMessage(msg.channel, "Sorry, this command is on cooldown.");
                  return;
                }
              });
            }
            if (!Commands[command].nsfw) {
              Debug.debuglogSomething("DougBot", "Safe for work command executed.", "info");
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
              Permissions.GetNSFW(msg.channel.server, msg.channel.id, function(err, reply) {
                Debug.debuglogSomething("DougBot", "Command is NSFW, checking if channel allows that.", "info");
                if (err) {
                  Logger.debug("Got an error! <" + err + ">");
                  Debug.debuglogSomething("NeDB", "NSFW channel check failed, got error: " + err, "error");
                  bot.sendMessage(msg.channel, "Sorry, an error occured, try again later.");
                  return;
                }
                if (reply === "on") {
                  Debug.debuglogSomething("DougBot", "NSFW command successfully executed.", "info");
                  Commands[command].fn(bot, msg, suffix);
                  return;
                } else {
                  Debug.debuglogSomething("DougBot", "NSFW command execution failed because of channel settings.", "info");
                  bot.sendMessage(msg.channel, "You cannot use NSFW commands in this channel!");
                }
              });
            }
          } else {
            Debug.debuglogSomething("DougBot", "User has no permission to use that command.", "info");
            bot.sendMessage(msg.channel, "You don't have permission to use this command!");
            return;
          }
        });
      } else if (!msg.channel.server) {
        Permissions.GetLevel(null, msg.author.id, function(err, level) { // Value of 0 is acting as a placeholder, because in DM's only global permissions apply.
          Debug.debuglogSomething("DougBot", "DM command detected, getting global perms.", "info");
          if (err) {
            Logger.debug("An error occured!");
            Debug.debuglogSomething("LevelDB", "GetLevel failed, got error: " + err, "error");
            return;
          }
          if (level >= Commands[command].level) {
            Debug.debuglogSomething("DougBot", "User has sufficient global perms.", "info");
            Commands[command].fn(bot, msg, suffix);
            return;
          } else {
            Debug.debuglogSomething("DougBot", "User does not have enough global permissions.", "info");
            bot.sendMessage(msg.channel, "You do not have sufficient global permissions to execute this command in DM.");
          }
        });
      }
    }
  }
});

// Initial functions
function init(token) {
  Debug.debuglogSomething("Discord", "Sucessfully logged into Discord, returned token: " + token, "info");
  Debug.debuglogSomething("DougBot", "Continuing start-up sequence.", "info");
  Logger.info("Checking for updates...");
  VersionChecker.getStatus(function(err, status) {
    if (err) {
      Logger.error(err);
      Debug.debuglogSomething("VersionChecker", "Version checking failed, got error: " + err, "error");
    } // error handle
    if (status && status !== "failed") {
      Logger.info(status);
    }
  });
}

// New user welcomer
bot.on("serverNewMember", function(server, user) {
  var welcomeWhitelist = require('./runtime/welcoming-whitelist.json');
  if (ConfigFile.bot_settings.welcome_new_members === false) return;
  if (welcomeWhitelist.indexOf(server.id) > -1) {
    bot.sendMessage(server.defaultChannel, "Welcome " + user.username + " to " + server.name + "!");
  }
});

function err(error) {
  Debug.debuglogSomething("Discord", "Logging into Discord probably failed, got error: " + error, "error");
}

process.on('uncaughtException', function(err) {
  if (err.code === 'ECONNRESET') {
    Logger.warn("Got an ECONNRESET error, this is most likely *not* a bug with WildBeast");
    Logger.debug(err.stack);
  } else {
    Logger.error(err.stack);
    process.exit(1);
  }
});
// Connection starter
bot.login(ConfigFile.discord.email, ConfigFile.discord.password).then(init).catch(err);
