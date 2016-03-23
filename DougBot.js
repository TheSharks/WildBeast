// DougBot 2.0 beta
// Define variables first
var Discord = require("discord.js"),
  bot = new Discord.Client({
    forceFetchUsers: true
  }),
  ConfigFile = require("./config.json"),
  Logger = require("./runtime/logger.js").Logger,
  Debug = require("./runtime/debugging.js"),
  ChatLogger = require("./runtime/logger.js").ChatLog,
  Commands = require("./runtime/commands.js").Commands,
  DJ = require("./runtime/djlogic.js"),
  Permissions = require("./runtime/permissions.js"),
  VersionChecker = require("./runtime/versionchecker.js"),
  aliases,
  UserDB = require('./runtime/user_nsa.js'),
  Upgrade = require('./runtime/upgrading.js'),
  Customize = require('./runtime/customization.js');

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
  Upgrade.databaseSystem(bot);
  Debug.debuglogSomething("Discord", "Ready event fired.", "info");
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
  Debug.debuglogSomething("Discord", "Disconnected from Discord.", "warn");
  Logger.warn("Disconnected, if this wasn't a connection issue or on purpose, report this issue to the author of the bot.");
  process.exit(0); // Disconnected announcments are not always an error, seeing that disconnections can be triggered by the user.
});

// Command checker
bot.on("message", function(msg) {
  UserDB.checkIfKnown(msg.sender).catch(function() {
    UserDB.trackNewUser(msg.sender).catch(function(e) {
      Logger.error(e);
    });
  });
  if (ConfigFile.bot_settings.log_chat === true && msg.channel.server) {
    var d = new Date();
    var n = d.toUTCString();
    ChatLogger.info(n + ": " + msg.channel.server.name + ", " + msg.channel.name + ": " + msg.author.username + " said <" + msg.cleanContent + ">");
  }
  var prefix;
  if (ConfigFile.bot_settings.cmd_prefix != "mention") {
    prefix = ConfigFile.bot_settings.cmd_prefix;
  } else if (ConfigFile.bot_settings.cmd_prefix === "mention") {
    prefix = bot.user + " ";
  } else {
    Logger.warn("Weird prefix detected.");
  }
  var step = msg.content.substr(prefix.length);
  var chunks = step.split(" ");
  var command = chunks[0].toLowerCase();
  alias = aliases[command];
  var suffix = msg.content.substring(command.length + (prefix.length + 1));
  if (msg.channel.isPrivate && msg.content.indexOf('https://discord.gg/') === 0) {
    Commands['join-server'].fn(bot, msg, msg.content);
  }
  if (msg.content.indexOf(prefix) === 0 && Commands[command]) {
    Logger.info('Executing <' + msg.cleanContent + '> from ' + msg.author.username);
    if (msg.channel.server) {
      Permissions.GetLevel(msg.channel.server, msg.sender.id).then(function(level) {
        if (level >= Commands[command].level) {
          if (Commands[command].music) {
            DJ.checkPerms(msg.channel.server, msg.sender).then(function() {
              Commands[command].fn(bot, msg, suffix);
              return;
            }).catch(function(e) {
              if (e === 'No permission') {
                bot.sendMessage(msg.channel, "Sorry " + msg.sender + ", you need a role called `Radio Master` to use this command.");
              } else {
                Logger.error(e);
                bot.sendMessage(msg.channel, "Something went wrong, try again.");
              }
            });
          } else if (Commands[command].nsfw) {
            Permissions.GetNSFW(msg.channel.server, msg.channel.id).then(function() {
              Commands[command].fn(bot, msg, suffix);
            }).catch(function(e) {
              if (e === 'No permission') {
                Customize.replyCheck('nsfw_disallowed_response', msg.channel.server).then(function(r) {
                  if (r === 'default') {
                    bot.sendMessage(msg.channel, "You cannot use NSFW commands in this channel!");
                    return;
                  } else {
                    var userstep = r.replace(/%user/g, msg.author.username);
                    var serverstep = userstep.replace(/%server/g, msg.channel.server.name);
                    var final = serverstep.replace(/%channel/, msg.channel);
                    bot.sendMessage(msg.channel, final);
                    return;
                  }
                }).catch(function(e) {
                  if (e === 'Nothing found!') {
                    Customize.initializeServer(msg.channel.server).then(function() {
                      bot.sendMessage(msg.channel, "You don't have permission to use this command!");
                    }).catch(function(e) {
                      Logger.error(e);
                    });
                  }
                });
              } else {
                Logger.error(e);
                bot.sendMessage(msg.channel, "You cannot use NSFW commands in this channel!");
                return;
              }
            });
          } else {
            Commands[command].fn(bot, msg, suffix);
          }
        } else {
          Customize.replyCheck('no_permission_response', msg.channel.server).then(function(r) {
            if (r === 'default') {
              bot.sendMessage(msg.channel, "You don't have permission to use this command!");
              return;
            } else {
              var userstep = r.replace(/%user/g, msg.author.username);
              var serverstep = userstep.replace(/%server/g, msg.channel.server.name);
              var final = serverstep.replace(/%channel/, msg.channel);
              bot.sendMessage(msg.channel, final);
              return;
            }
          }).catch(function(e) {
            if (e === 'Nothing found!') {
              Customize.initializeServer(msg.channel.server).then(function() {
                bot.sendMessage(msg.channel, "You don't have permission to use this command!");
              }).catch(function(e) {
                Logger.error(e);
              });
            }
          });
        }
      }).catch(function(e) {
        if (e === 'Nothing found!') {
          Logger.debug('Making a new server document since there was none present.');
          Permissions.initializeServer(msg.channel.server).then(function() {
            bot.sendMessage(msg.channel, "Something went wrong, try again."); // The user does not need to know we didnt have a database doc
          }).catch(function(e) {
            Logger.error(e);
          });
        } else {
          Logger.error(e);
        }
      });
    } else if (msg.channel.isPrivate) {
      if (Commands[command].music) {
        bot.sendMessage(msg.channel, "You can't use music commands in DM!");
        return;
      }
      Permissions.GetLevel(null, msg.sender.id).then(function(level) {
        if (level >= Commands[command].level) {
          Commands[command].fn(bot, msg, suffix);
        } else {
          bot.sendMessage(msg.channel, "You don't have enough global permissions to execute this in DM.");
        }
      }).catch(function(e) {
        Logger.error(e);
      });
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
  UserDB.checkIfKnown(user).catch(function() {
    UserDB.trackNewUser(user).catch(function(e) {
      Logger.error(e);
    });
  });
  Customize.checkWelcoming(server).then(function(r) {
    if (r === 'default') {
      bot.sendMessage(server.defaultChannel, "Welcome " + user.username + " to **" + server.name + "**!");
    } else {
      var userstep = r.replace(/%user/g, msg.author.username);
      var serverstep = userstep.replace(/%server/g, msg.channel.server.name);
      var final = serverstep.replace(/%channel/, msg.channel);
      bot.sendMessage(msg.channel, final);
    }
  }).catch(function(e) {
    if (e === 'Welcoming turned off.') {
      return;
    } else if (e === 'Not found!') {
      Customize.initializeServer(server).catch(function(e) {
        Logger.error(e);
      });
    }
  });
});

// Log server leaves, so database won't get cluttered with ghost documents
bot.on('serverDeleted', function(server) {
  Customize.removeServer(server);
  Permissions.removeServer(server);
  Logger.info('Left a server and removed database documents.');
});

function err(error) {
  Debug.debuglogSomething("Discord", "Logging into Discord probably failed, got error: " + error, "error");
  Logger.error('Failed to log into Discord! Make sure the login details are correct.');
  process.exit(0);
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

bot.on('serverCreated', function(server) {
  // Since join-server doenst work for oauth bots, we need to be creative with the joined announcement
  var msgArray = [];
  Permissions.initializeServer(server);
  Customize.initializeServer(server);
  msgArray.push("Hey! I'm " + bot.user.username);
  if (ConfigFile.discord.token_mode === true) {
    msgArray.push("Someone with `manage server` permissions invited me to this server via OAuth.");
  } else {
    msgArray.push('I followed an instant-invite from someone.'); // TODO: We need something to resolve the invite we just followed and return who invited the bot.
  }
  msgArray.push("If I'm intended to be here, use `" + ConfigFile.bot_settings.cmd_prefix + "help` to see what I can do.");
  msgArray.push("Else, use `" + ConfigFile.bot_settings.cmd_prefix + "leave` or just kick me.");
  bot.sendMessage(server.defaultChannel, msgArray);
});

bot.on('presence', function(olduser, newuser) {
  if (ConfigFile.bot_settings.namechange_log === true) {
    UserDB.checkIfKnown(newuser).catch(function() {
      UserDB.trackNewUser(newuser).catch(function(e) {
        Logger.error(e);
      });
    });
    // We only handle namechanges, nothing else
    if (olduser.username === newuser.username) {
      return;
    } else {
      UserDB.handleNamechange(newuser);
    }
  } else {
    return;
  }
});

// Support direct API logins with tokens via 'token_mode'
if (ConfigFile.discord.token_mode === true) {
  bot.loginWithToken(ConfigFile.discord.token).then(init).catch(err);
} else if (ConfigFile.discord.token_mode === false) {
  bot.login(ConfigFile.discord.email, ConfigFile.discord.password).then(init).catch(err);
}
