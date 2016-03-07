var ConfigFile = require("../config.json"),
  Logger = require("./logger.js").Logger,
  Permissions = require("./permissions.js"),
  imgDirectory = require("../config.json").image_folder,
  Giphy = require("./giphy.js"),
  Cleverbot = require('cleverbot-node'),
  cleverbot = new Cleverbot(),
  yt = require("./youtube_plugin"),
  youtube_plugin = new yt(),
  version = require("../package.json").version,
  unirest = require('unirest'),
  Debug = require("./debugging.js"),
  Defaulting = require("./serverdefaulting.js"),
  DJ = require("./djlogic.js"),
  aliases = require("./alias.json"),
  ignore = require("./ignoring.js");

var Commands = [];

Commands.ping = {
  name: "ping",
  help: "I'll reply to you with pong!",
  level: 0,
  timeout: 10,
  fn: function(bot, msg) {
    bot.reply(msg, "Pong!"); // Easy for moderation
  }
};

Commands.nowplaying = {
  name: "nowplaying",
  help: "Returns what video is currently playing.",
  music: true,
  level: 0,
  fn: function(bot, msg) {
    DJ.returnNowPlaying(bot, msg);
  }
};

Commands.forceskip = {
  name: "forceskip",
  help: "Forces a song to skip.",
  level: 2,
  fn: function(bot, msg) {
    DJ.expSkip(bot, msg);
  }
};

Commands.request = {
  name: "request",
  help: "Adds a video to the playlist.",
  level: 0,
  music: true,
  fn: function(bot, msg, suffix) {
    DJ.playlistAdd(bot, msg, suffix);
  }
};

Commands.playlist = {
  name: "playlist",
  help: "Returns the playlist.",
  level: 0,
  fn: function(bot, msg) {
    DJ.playlistFetch(bot, msg);
  }
};

Commands.playliststart = {
  name: "playliststart",
  help: "Starts the playlist!",
  music: true,
  level: 0,
  fn: function(bot, msg) {
    DJ.startPlaylist(bot, msg);
  }
};

Commands.e621 = {
  name: "e621",
  help: "e621, the definition of *Stop taking the Internet so seriously.*",
  usage: "<tags> multiword tags need to be typed like: wildbeast_is_a_discord_bot",
  level: 0,
  nsfw: true,
  fn: function(bot, msg, suffix) {
    bot.startTyping(msg.channel);
    unirest.post("https://e621.net/post/index.json?limit=30&tags=" + suffix) // Fetching 30 posts from E621 with the given tags
      .end(function(result) {
        if (result.body.length < 1) {
          bot.reply(msg, "sorry, nothing found."); // Correct me if it's wrong.
          bot.stopTyping(msg.channel);
          return;
        } else {
          var count = Math.floor((Math.random() * result.body.length));
          var FurryArray = [];
          FurryArray.push(msg.sender + ", you've searched for `" + suffix + "`"); // hehe no privacy if you do the nsfw commands now.
          FurryArray.push(result.body[count].file_url);
          bot.sendMessage(msg.channel, FurryArray);
          bot.stopTyping(msg.channel);
        }
      });
  }
};

Commands.eval = {
  name: "eval",
  help: "Allows the execution of arbitrary Javascript code within the context of the bot.",
  level: 6, // Now 100% sure it can't be used by anyone but the master user.
  fn: function(bot, msg, suffix) {
    try {
      bot.sendMessage(msg.channel, eval(suffix));
    } catch (err) {
      bot.sendMessage(msg.channel, "Eval failed :(");
      bot.sendMessage(msg.channel, "```" + err + "```");
    }
  }
};

Commands.alias = {
  name: "alias",
  help: "Allows for creating quick custom commands on the fly!",
  level: 5,
  fn: function(bot, msg, suffix) {
    var args = suffix.split(" ");
    var name = args.shift();
    if (!name) {
      return;
    } else if (Commands[name] || name === "help") {
      bot.sendMessage(msg.channel, "Overwriting commands with aliases is not allowed!");
    } else {
      var command = args.shift();
      aliases[name] = [command, args.join(" ")];
      //now save the new alias
      require("fs").writeFile("./runtime/alias.json", JSON.stringify(aliases, null, 2), null);
      bot.sendMessage(msg.channel, "Created alias " + name);
    }
  }
};

Commands["join-voice"] = {
  name: "join-voice",
  help: "I'll join a voice channel!",
  usage: "[voice-channel-name]",
  level: 0,
  music: true,
  fn: function(bot, msg) {
    DJ.joinVoice(bot, msg);
  }
};

Commands.stop = {
  name: "stop",
  help: "I'll stop playing music.",
  level: 0,
  music: true,
  fn: function(bot, msg) {
    DJ.stopPlaying(bot, msg);
  }
};

Commands["leave-voice"] = {
  name: "leave-voice",
  help: "I'll leave the current voice channel.",
  level: 0,
  music: true,
  fn: function(bot, msg) {
    DJ.leaveVoice(bot, msg);
  }
};

Commands.setstatus = {
  name: "setstatus",
  help: "This will change my current status to something else.",
  usage: "<online / away> [playing status]",
  level: 5,
  fn: function(bot, msg, suffix) {
    var step = suffix.split(" "),
      status = step[0],
      playingstep = step.slice(1, step.length),
      playing = playingstep.join(" ");
    if (!suffix) {
      bot.sendMessage(msg.channel, "You need a suffix, dummy!");
      return;
    }
    if (status === "online" || status === "away") {
      bot.setStatus(status, playing, function(error) {
        if (error) {
          bot.sendMessage(msg.channel, "Whoops, that doesn't work, try again.");
        } else if (playing) {
          bot.sendMessage(msg.channel, "Okay, I'm now " + status + " and playing " + playing);
        } else {
          bot.sendMessage(msg.channel, "Okay, I'm now " + status + ".");
        }
      });
    } else {
      bot.sendMessage(msg.channel, "I can only be `online` or `away`!");
      return;
    }
  }
};

Commands.fortunecow = {
  name: "fortunecow",
  help: "I'll get a random fortunecow!",
  level: 0,
  fn: function(bot, msg) {
    bot.startTyping(msg.channel);
    unirest.get("https://thibaultcha-fortunecow-v1.p.mashape.com/random")
      .header("X-Mashape-Key", ConfigFile.api_keys.mashape_key)
      .header("Accept", "text/plain")
      .end(function(result) {
        bot.reply(msg, "```" + result.body + "```");
        bot.stopTyping(msg.channel);
      });
  }
};

Commands.leetspeak = {
  name: "leetspeak",
  help: "1'Ll 3nc0D3 Y0uR Me5s@g3 1Nt0 l337sp3@K!",
  level: 0,
  fn: function(bot, msg, suffix) {
    if (suffix.length > 0 ) {
       var leetspeak = require("leetspeak");
       var thing = leetspeak(suffix);
       bot.reply(msg, thing);
	} else {
       bot.reply(msg, "*You need to type something to encode your message into l337sp3@K!*");
    }
  }
};

Commands.randomcat = {
  name: "randomcat",
  help: "I'll get a random cat image for you!",
  level: 0,
  fn: function(bot, msg, suffix) {
    bot.startTyping(msg.channel);
    unirest.get("https://nijikokun-random-cats.p.mashape.com/random")
      .header("X-Mashape-Key", ConfigFile.api_keys.mashape_key)
      .header("Accept", "application/json")
      .end(function(result) {
        bot.reply(msg, result.body.source);
        bot.stopTyping(msg.channel);
      });
  }
};

Commands.info = {
  name: "info",
  help: "I'll print some information about me.",
  level: 0,
  fn: function(bot, msg) {
    var msgArray = [];
    msgArray.push("**WildBeast version " + version + "**");
    msgArray.push("Using latest 6.x.x *Discord.js* version by *hydrabolt*.");
    msgArray.push("Made primarily by Dougley, Mirrow and Perpetucake.");
    bot.sendMessage(msg.channel, msgArray);
  }
};

Commands.cleverbot = {
  name: "cleverbot",
  help: "I'll act as Cleverbot when you execute this command, remember to enter a message as suffix.",
  usage: "<message>",
  level: 0,
  fn: function(bot, msg, suffix) {
    Cleverbot.prepare(function() {
      bot.startTyping(msg.channel);
      cleverbot.write(suffix, function(response) {
        bot.reply(msg, response.message);
        bot.stopTyping(msg.channel);
      });
    });
  }
};

Commands.leave = {
  name: "leave",
  help: "I'll leave the server in which the command is executed.",
  level: 3,
  fn: function(bot, msg, suffix) {
    if (msg.channel.server) {
      bot.sendMessage(msg.channel, "Alright, see ya!");
      bot.leaveServer(msg.channel.server);
      Logger.log("info", "I've left a server on request of " + msg.sender.username + ", I'm only in " + bot.servers.length + " servers now.");
      return;
    } else {
      bot.sendMessage(msg.channel, "I can't leave a DM, dummy!");
      return;
    }
  }
};

Commands.say = {
  name: "say",
  help: "I'll echo the suffix of the command to the channel and, if I have sufficient permissions, I will delete the command.",
  usage: "<text>",
  level: 0,
  fn: function(bot, msg, suffix) {
    if (suffix.indexOf(ConfigFile.bot_settings.cmd_prefix + "say") === -1) {
      bot.sendMessage(msg.channel, msg.sender + ", " + suffix);
      if (msg.channel.server) {
        var bot_permissions = msg.channel.permissionsOf(bot.user);
        if (bot_permissions.hasPermission("manageMessages")) {
          bot.deleteMessage(msg);
          return;
        } else {
          bot.sendMessage(msg.channel, "*This works best when I have the permission to delete messages!*"); // Note that this can be spammy if server owner doesn't care.
        }
      }
    } else {
      bot.sendMessage(msg.channel, "HEY " + msg.sender + " STOP THAT!", {
        tts: "true"
      });
    }
  }
};

Commands.online = {
  name: "online",
  help: "I'll change my status to online.",
  level: 5, // If an access level is set to 4 or higher, only the master user can use this
  fn: function(bot, msg) {
    bot.setStatusOnline();
    Logger.log("debug", "My status has been changed to online.");
  }
};

Commands.killswitch = {
  name: "killswitch",
  help: "This will instantly terminate all of the running instances of the bot without restarting.",
  level: 5, // If an access level is set to 4 or higher, only the master user can use this
  fn: function(bot, msg) {
      bot.sendMessage(msg.channel, "An admin has requested to kill all instances of WildBeast, exiting...");
      bot.logout();
      Logger.log("warn", "Disconnected via killswitch!");
      process.exit(0);
    } //exit node.js without an error
};

Commands.image = {
  name: "image",
  help: "I'll search teh interwebz for a picture matching your tags.",
  usage: "<image tags>",
  level: 0,
  fn: function(bot, msg, suffix) {
    if (!ConfigFile || !ConfigFile.api_keys.google_key || !ConfigFile.api_keys.cse_key) {
      bot.sendMessage(msg.channel, "Image search requires **both** a Google API key and a CSE key!");
      return;
    }
    //gets us a random result in first 5 pages
    var page = 1 + Math.floor(Math.random() * 5) * 10; //we request 10 items
    var request = require("request");
    request("https://www.googleapis.com/customsearch/v1?key=" + ConfigFile.api_keys.google_key + "&cx=" + ConfigFile.api_keys.cse_key + "&q=" + (suffix.replace(/\s/g, '+')) + "&searchType=image&alt=json&num=10&start=" + page, function(err, res, body) {
      var data, error;
      try {
        data = JSON.parse(body);
      } catch (error) {
        Logger.error(error);
        return;
      }
      if (!data) {
        Logger.debug(data);
        bot.sendMessage(msg.channel, "Error:\n" + JSON.stringify(data));
        return;
      } else if (!data.items || data.items.length === 0) {
        Logger.debug(data);
        bot.sendMessage(msg.channel, "No result for '" + suffix + "'");
        return;
      }
      var randResult = data.items[Math.floor(Math.random() * data.items.length)];
      bot.sendMessage(msg.channel, randResult.title + '\n' + randResult.link);
    });
    Logger.log("debug", "I've looked for images of " + suffix + " for " + msg.sender.username);
  }
};

Commands.pullanddeploy = {
  name: "pullanddeploy",
  help: "I'll check if my code is up-to-date with the code from <@107904023901777920>, and restart. **Please note that this does NOT work on Windows!**",
  level: 5, // If an access level is set to 4 or higher, only the master user can use this
  fn: function(bot, msg, suffix) {
    bot.sendMessage(msg.channel, "Fetching updates...", function(error, sentMsg) {
      Logger.log("info", "Updating...");
      var spawn = require('child_process').spawn;
      var log = function(err, stdout, stderr) {
        if (stdout) {
          Logger.log("debug", stdout);
        }
        if (stderr) {
          Logger.log("debug", stderr);
        }
      };
      var fetch = spawn('git', ['fetch']);
      fetch.stdout.on('data', function(data) {
        Logger("debug", data.toString());
      });
      fetch.on("close", function(code) {
        var reset = spawn('git', ['reset', '--hard', 'origin/master']);
        reset.stdout.on('data', function(data) {
          Logger.log("debug", data.toString());
        });
        reset.on("close", function(code) {
          var npm = spawn('npm', ['install']);
          npm.stdout.on('data', function(data) {
            Logger.log("debug", data.toString());
          });
          npm.on("close", function(code) {
            Logger.log("info", "Goodbye");
            bot.sendMessage(msg.channel, "brb!", function() {
              bot.logout(function() {
                process.exit();
              });
            });
          });
        });
      });
    });
  }
};

Commands.youtube = {
  name: "youtube",
  help: "I'll search YouTube for a video matching your given tags.",
  usage: "<video tags>",
  level: 0,
  fn: function(bot, msg, suffix) {
    youtube_plugin.respond(suffix, msg.channel, bot);
  }
};

Commands.purge = {
  name: "purge",
  help: "I'll delete a certain ammount of messages.",
  usage: "<number-of-messages-to-delete>",
  level: 2,
  fn: function(bot, msg, suffix) {
    if (!msg.channel.server) {
      bot.sendMessage(msg.channel, "You can't do that in a DM, dummy!");
      return;
    }
    if (!suffix || isNaN(suffix)) {
      bot.sendMessage(msg.channel, "Please define an ammount of messages for me to delete!");
      return;
    }
    if (!msg.channel.permissionsOf(msg.sender).hasPermission("manageMessages")) {
      bot.sendMessage(msg.channel, "Sorry, your role in this server does not have enough permissions.");
      return;
    }
    if (!msg.channel.permissionsOf(bot.user).hasPermission("manageMessages")) {
      bot.sendMessage(msg.channel, "I don't have permission to do that!");
      return;
    }
    if (suffix > 100) {
      bot.sendMessage(msg.channel, "The maximum is 100.");
      return;
    }
    bot.getChannelLogs(msg.channel, suffix, function(error, messages) {
      if (error) {
        bot.sendMessage(msg.channel, "Something went wrong while fetching logs.");
        return;
      } else {
        Logger.info("Beginning purge...");
        var todo = messages.length,
          delcount = 0;
        for (msg of messages) {
          bot.deleteMessage(msg);
          todo--;
          delcount++;
          if (todo === 0) {
            bot.sendMessage(msg.channel, "Done! Deleted " + delcount + " messages.");
            Logger.info("Ending purge, deleted " + delcount + " messages.");
            return;
          }
        }
      }
    });
  }
};

Commands.kappa = {
  name: "kappa",
  help: "Sends kappa picture",
  level: 0,
  fn: function(bot, msg, suffix) {
    bot.sendFile(msg.channel, "./images/kappa.png");
    if (msg.channel.server) {
      var bot_permissions = msg.channel.permissionsOf(bot.user);
      if (bot_permissions.hasPermission("manageMessages")) {
        bot.deleteMessage(msg);
        return;
      } else {
        bot.sendMessage(msg.channel, "*This works best when I have the permission to delete messages!*");
      }
    }
  }
};

Commands.whois = {
  name: "whois",
  help: "I'll get some information about the user you've mentioned.",
  level: 0,
  fn: function(bot, msg) {
    var UserLevel = 0;
    if (!msg.channel.server) {
      bot.sendMessage(msg.author, "I can't do that in a DM, sorry.");
      return;
    }
    if (msg.mentions.length === 0) {
      bot.sendMessage(msg.channel, "Please mention the user that you want to get information of.");
      return;
    }
    msg.mentions.map(function(user) {
      Permissions.GetLevel((msg.channel.server.id + user.id), user.id, function(err, level) {
        if (err) {
          return;
        } else {
          UserLevel = level;
        }
        var msgArray = [];
        if (user.avatarURL === null) {
          msgArray.push("Information requested by " + msg.sender);
          msgArray.push("Requested user: `" + user.username + "`");
          msgArray.push("ID: `" + user.id + "`");
          msgArray.push("Discriminator: `#" + user.discriminator + "`");
          msgArray.push("Status: `" + user.status + "`");
          msgArray.push("Current access level: " + UserLevel);
          bot.sendMessage(msg.channel, msgArray);
          return;
        } else {
          msgArray.push("Information requested by " + msg.sender);
          msgArray.push("Requested user: `" + user.username + "`");
          msgArray.push("ID: `" + user.id + "`");
          msgArray.push("Discriminator: `#" + user.discriminator + "`");
          msgArray.push("Status: `" + user.status + "`");
          msgArray.push("Avatar: " + user.avatarURL);
          msgArray.push("Current access level: " + UserLevel);
          bot.sendMessage(msg.channel, msgArray);
        }
      });
    });
  }
};

Commands.setlevel = {
  name: "setlevel",
  help: "This changes the permission level of an user.",
  level: 3,
  fn: function(bot, msg, suffix) {
    if (!msg.channel.server) {
      bot.sendMessage(msg.channel, "I can't do that in a PM!");
      return;
    }
    if (isNaN(suffix[0])) {
      bot.reply(msg, "your first param is not a number!");
      return;
    }
    if (suffix[0] > 3) {
      bot.sendMessage(msg.channel, "Setting a level higher than 3 is not allowed.");
      return;
    }
    if (msg.mentions.length === 0) {
      bot.reply(msg, "please mention the user(s) you want to set the permission level of.");
      return;
    }
    Permissions.GetLevel((msg.channel.server.id + msg.author.id), msg.author.id, function(err, level) {
      if (err) {
        bot.sendMessage(msg.channel, "Help! Something went wrong!");
        return;
      }
      if (suffix[0] > level) {
        bot.reply(msg, "you can't set a user's permissions higher than your own!");
        return;
      }
    });
    msg.mentions.map(function(user) {
      Permissions.SetLevel((msg.channel.server.id + user.id), suffix[0], function(err, level) {
        if (err) {
          bot.sendMessage(msg.channel, "Help! Something went wrong!");
          return;
        }
      });
    });
    bot.sendMessage(msg.channel, "Alright! The permission levels have been set successfully!");
  }
};

Commands.setnsfw = {
  name: "setnsfw",
  help: "This changes if the channel allows NSFW commands.",
  usage: "<on | off>",
  level: 3,
  fn: function(bot, msg, suffix) {
    if (!msg.channel.server) {
      bot.sendMessage(msg.channel, "NSFW commands are always allowed in DM's.");
      return;
    }
    if (suffix === "on" || suffix === "off") {
      Permissions.SetNSFW(msg.channel, suffix, function(err, allow) {
        if (err) {
          bot.reply(msg.channel, "I've failed to set NSFW flag!");
        }
        if (allow === "on") {
          bot.sendMessage(msg.channel, "NSFW commands are now allowed for " + msg.channel);
        } else if (allow === "off") {
          bot.sendMessage(msg.channel, "NSFW commands are now disallowed for " + msg.channel);
        } else {
          bot.reply(msg.channel, "I've failed to set NSFW flag!");
        }
      });
    }
  }
};

Commands.setowner = {
  name: "setowner",
  help: "This will set the owner of the current server to level 4.",
  level: 0,
  fn: function(bot, msg) {
    if (msg.channel.isPrivate) {
      bot.sendMessage(msg.channel, "You need to execute this command in a server, dummy!");
      return;
    } else {
      Permissions.SetLevel((msg.channel.server.id + msg.channel.server.owner.id), 4, function(err, level) {
        if (err) {
          bot.sendMessage(msg.channel, "Sorry, an error occured, try again later.");
          return;
        }
        if (level === 4) {
          bot.sendMessage(msg.channel, "Okay! " + msg.channel.server.owner + " is now at level 4!");
        }
      });
    }
  }
};

Commands.hello = {
  name: "hello",
  help: "I'll respond to you with hello along with a GitHub link, handy!",
  level: 0,
  fn: function(bot, msg) {
    bot.sendMessage(msg.channel, "Hello " + msg.sender + "! I'm " + bot.user.username + ", help me grow by contributing to my GitHub: https://github.com/SteamingMutt/WildBeast");
  }
};

Commands["server-info"] = {
  name: "server-info",
  help: "I'll tell you some information about the server you're currently in.",
  level: 0,
  fn: function(bot, msg, suffix) {
    // if we're not in a PM, return some info about the channel
    if (msg.channel.server) {
      var msgArray = [];
      msgArray.push("Information requested by " + msg.sender);
      msgArray.push("Server name: **" + msg.channel.server.name + "** (id: `" + msg.channel.server.id +"`)");
      msgArray.push("Owned by **" + msg.channel.server.owner.username + "** (id: `" + msg.channel.server.owner.id + "`)");
      msgArray.push("Current region: **" + msg.channel.server.region + '**.');
      msgArray.push('This server has **' + msg.channel.server.members.length + '** members, and **' + msg.channel.server.channels.length + '** channels. (Including voice channels)');
      msgArray.push('This server has **' + msg.channel.server.roles.length + '** roles registered.');
      if (msg.channel.server.icon === null) {
        msgArray.push('No server icon present.');
      } else {
        msgArray.push('Server icon: ' + msg.channel.server.iconURL);
      }
      if (msg.channel.server.afkChannel === null) {
        msgArray.push('No voice AFK-channel present.');
      } else {
        msgArray.push('Voice AFK-channel: **' + msg.channel.server.afkChannel.name + "** (id: `" + msg.channel.server.afkChannel.id + "`)");
      }
      bot.sendMessage(msg, msgArray);
    } else {
      bot.sendMessage(msg, "You can't do that in a DM, dummy!.");
    }
  }
};

Commands.birds = {
  name: "birds",
  help: "The best stale meme evahr, IDST.",
  level: 0,
  fn: function(bot, msg) {
    var msgArray = [];
    msgArray.push("https://www.youtube.com/watch?v=Kh0Y2hVe_bw");
    msgArray.push(msg.sender + ", we just don't know");
    bot.sendMessage(msg, msgArray);
  }
};

Commands["join-server"] = {
  name: "join-server",
  help: "I'll join the server you've requested me to join, as long as the invite is valid and I'm not banned of already in the requested server.",
  usage: "<bot-username> <instant-invite>",
  level: 0,
  fn: function(bot, msg, suffix) {
    suffix = suffix.split(" ");
    if (suffix[0] === bot.user.username) {
      Logger.log("debug", bot.joinServer(suffix[1], function(error, server) {
        Logger.log("debug", "callback: " + arguments);
        if (error || !server) {
          Logger.warn("Failed to join a server: " + error);
          bot.sendMessage(msg.channel, "Something went wrong, try again.");
        } else {
          var msgArray = [];
          msgArray.push("Yo! I'm **" + bot.user.username + "**, " + msg.author + " invited me to this server.");
          msgArray.push("If I'm intended to be in this server, you may use **" + ConfigFile.bot_settings.cmd_prefix + "help** to see what I can do!");
          msgArray.push("If you don't want me here, you may use **" + ConfigFile.bot_settings.cmd_prefix + "leave** to ask me to leave.");
          Permissions.SetLevel((server.id + server.owner.id), 4, function(err, level) {
            if (err) {
              bot.sendMessage(server.defaultChannel, "An error occured while auto-setting " + server.owner + " to level 4, try running `setowner` a bit later.");
            }
            if (level === 4) {
              bot.sendMessage(server.defaultChannel, "I have detected " + server.owner + " as the server owner and made him/her an admin over me.");
            }
          });
          bot.sendMessage(server.defaultChannel, msgArray);
          msgArray = [];
          msgArray.push("Hey " + server.owner.username + ", I've joined " + server.name + " in which you're the founder.");
          msgArray.push("I'm " + bot.user.username + " by the way, a Discord bot, meaning that all of the things I do are mostly automated.");
          msgArray.push("If you are not keen on having me in your server, you may use `" + ConfigFile.bot_settings.cmd_prefix + "leave` in the server I'm not welcome in.");
          msgArray.push("If you do want me, use `" + ConfigFile.bot_settings.cmd_prefix + "help` to see what I can do.");
          bot.sendMessage(server.owner, msgArray);
          bot.sendMessage(msg.channel, "I've successfully joined **" + server.name + "**");
        }
      }));
    } else {
      Logger.log("debug", "Ignoring join command meant for another bot.");
    }
  }
};

Commands['check-voice'] = {
  name: "check-voice",
  help: "I'll check if I'm available to stream music right now.",
  level: 0,
  fn: function(bot, msg) {
    DJ.checkIfAvailable(bot, msg);
  }
};

Commands.idle = {
  name: "idle",
  help: "This will change my status to idle.",
  level: 5, // If an access level is set to 4 or higher, only the master user can use this
  fn: function(bot, msg) {
    bot.setStatusIdle();
    Logger.log("debug", "My status has been changed to idle.");
  }
};

Commands.meme = {
  name: "meme",
  help: "I'll create a meme with your suffixes!",
  usage: '<memetype> "<Upper line>" "<Bottom line>" **Quotes are important!**',
  level: 0,
  fn: function(bot, msg, suffix) {
    var tags = msg.content.split('"');
    var memetype = tags[0].split(" ")[1];
    var meme = require("./memes.json");
    //bot.sendMessage(msg.channel,tags);
    var Imgflipper = require("imgflipper");
    var imgflipper = new Imgflipper(ConfigFile.imgflip.username, ConfigFile.imgflip.password);
    imgflipper.generateMeme(meme[memetype], tags[1] ? tags[1] : "", tags[3] ? tags[3] : "", function(err, image) {
      //CmdErrorLog.log("debug", arguments);
      bot.reply(msg, image);
      if (!msg.channel.server) {
        return;
      }
      var bot_permissions = msg.channel.permissionsOf(bot.user);
      if (bot_permissions.hasPermission("manageMessages")) {
        bot.deleteMessage(msg);
        return;
      } else {
        bot.sendMessage(msg.channel, "*This works best when I have the permission to delete messages!*");
      }
    });
  }
};

Commands.rule34 = {
  name: "rule34",
  help: "Rule#34 : If it exists there is porn of it. If not, start uploading.",
  level: 0,
  nsfw: true,
  fn: function(bot, msg, suffix) {
    bot.startTyping(msg.channel);
    unirest.post("http://rule34.xxx/index.php?page=dapi&s=post&q=index&tags=" + suffix) // Fetching 100 rule34 pics
      .end(function(result) {
        var xml2js = require('xml2js');
        if (result.body.length < 75) {
          bot.reply(msg, "sorry, nothing found."); // Correct me if it's wrong.
          bot.stopTyping(msg.channel);
          return;
        } else {
          xml2js.parseString(result.body, function(err, reply) {
            var count = Math.floor((Math.random() * reply.posts.post.length));
            var FurryArray = [];
            FurryArray.push(msg.sender + ", you've searched for `" + suffix + "`"); // hehe no privacy if you do the nsfw commands now.
            FurryArray.push("http:" + reply.posts.post[count].$.file_url);
            bot.sendMessage(msg.channel, FurryArray);
            bot.stopTyping(msg.channel);
          });
        }
      });
  }
};

Commands.status = {
  name: "status",
  help: "I'll get some info about me, like uptime and currently connected servers.",
  level: 0,
  fn: function(bot, msg) {
    var msgArray = [];
    msgArray.push("Hello " + msg.sender + ", I'm " + bot.user + ", nice to meet you!");
    msgArray.push("I'm used in " + bot.servers.length + " servers, in " + bot.channels.length + " channels and by " + bot.users.length + " users.");
    msgArray.push("My uptime is " + (Math.round(bot.uptime / (1000 * 60 * 60))) + " hours, " + (Math.round(bot.uptime / (1000 * 60)) % 60) + " minutes, and " + (Math.round(bot.uptime / 1000) % 60) + " seconds.");
    bot.sendMessage(msg.channel, msgArray);
  }
};

Commands.iff = {
  name: "iff",
  help: "''**I**mage **F**rom **F**ile'', I'll get a image from the image folder for you and upload it to the channel.",
  usage: "<image>",
  level: 0,
  fn: function(bot, msg, suffix) {
    var fs = require("fs");
    var path = require("path");
    var ext = [".jpg", ".jpeg", ".gif", ".png"];
    var imgArray = [];
    fs.readdir("./images", function(err, dirContents) {
      for (var i = 0; i < dirContents.length; i++) {
        for (var o = 0; o < ext.length; o++) {
          if (path.extname(dirContents[i]) === ext[o]) {
            imgArray.push(dirContents[i]);
          }
        }
      }
      if (imgArray.indexOf(suffix) !== -1) {
        bot.sendFile(msg.channel, "./images/" + suffix);
        if (!msg.channel.server) {
          return;
        }
        var bot_permissions = msg.channel.permissionsOf(bot.user);
        if (bot_permissions.hasPermission("manageMessages")) {
          bot.deleteMessage(msg);
          return;
        } else {
          bot.sendMessage(msg.channel, "*This works best when I have the permission to delete messages!*");
        }
      } else {
        bot.sendMessage(msg.channel, "*Invalid input!*");
      }
    });
  }
};

Commands.ban = {
  name: "ban",
  help: "Swing the banhammer on someone!",
  usage: "<user-mention>",
  level: 2,
  fn: function(bot, msg) {
    if (!msg.channel.permissionsOf(msg.sender).hasPermission("banMembers")) {
      bot.sendMessage(msg.channel, "Sorry, your role in this server does not have enough permissions.");
      return;
    }
    if (!msg.channel.permissionsOf(bot.user).hasPermission("banMembers")) {
      bot.sendMessage(msg.channel, "I don't have enough permissions to do this!");
      return;
    }
    if (msg.mentions.length === 0) {
      bot.sendMessage(msg.channel, "Please mention the user(s) you want to ban.");
      return;
    }
    msg.mentions.map(function(user) {
      bot.banMember(user.id, msg.channel.server.id, function(error) {
        if (error) {
          bot.sendMessage(msg.channel, "Failed to ban " + user);
        } else if (!error) {
          bot.sendMessage(msg.channel, "Banned " + user);
        }
      });
    });
  }
};

Commands.purgeban = {
  name: "purgeban",
  help: "Swing the banhammer and delete messages at the same time!",
  usage: "<days-to-delete> <user-mention>",
  level: 2,
  fn: function(bot, msg, suffix) {
    if (!msg.channel.permissionsOf(msg.sender).hasPermission("banMembers")) {
      bot.sendMessage(msg.channel, "Sorry, your role in this server does not have enough permissions.");
      return;
    }
    if (!msg.channel.permissionsOf(bot.user).hasPermission("banMembers")) {
      bot.sendMessage(msg.channel, "I don't have enough permissions to do this!");
      return;
    }
    if (msg.mentions.length === 0) {
      bot.sendMessage(msg.channel, "Please mention the user(s) you want to ban.");
      return;
    }
    if (isNaN(suffix[0])) {
      bot.sendMessage(msg.channel, "Your first parameter is not a number, use `ban` to ban without deleting messages.");
      return;
    }
    msg.mentions.map(function(user) {
      bot.banMember(user.id, msg.channel.server.id, suffix[0], function(error) {
        if (error) {
          bot.sendMessage(msg.channel, "Failed to ban " + user);
        } else if (!error) {
          bot.sendMessage(msg.channel, "Banned " + user + " and deleted " + suffix[0] + " days worth of messages.");
        }
      });
    });
  }
};

Commands.kick = {
  name: "kick",
  help: "Kick an user out of the server!",
  usage: "<user-mention>",
  level: 1,
  fn: function(bot, msg) {
    if (!msg.channel.permissionsOf(msg.sender).hasPermission("kickMembers")) {
      bot.sendMessage(msg.channel, "Sorry, your role in this server does not have enough permissions.");
      return;
    }
    if (!msg.channel.permissionsOf(bot.user).hasPermission("kickMembers")) {
      bot.sendMessage(msg.channel, "I don't have enough permissions to do this!");
      return;
    }
    if (msg.mentions.length === 0) {
      bot.sendMessage(msg.channel, "Please mention the user(s) you want to kick.");
      return;
    }
    msg.mentions.map(function(user) {
      bot.kickMember(user.id, msg.channel.server.id, function(error) {
        if (error) {
          bot.sendMessage(msg.channel, "Failed to kick " + user);
        } else if (!error) {
          bot.sendMessage(msg.channel, "Kicked " + user);
        }
      });
    });
  }
};

Commands.gif = {
  name: "gif",
  help: "I will search Giphy for a gif matching your tags.",
  usage: "<image tags>",
  level: 0,
  fn: function(bot, msg, suffix) {
    var tags = suffix.split(" ");
    Giphy.get_gif(tags, function(id) {
      if (typeof id !== "undefined") {
        bot.reply(msg, "http://media.giphy.com/media/" + id + "/giphy.gif [Tags: " + (tags ? tags : "Random GIF") + "]");
      } else {
        bot.reply(msg, "sorry! Invalid tags, try something different. For example, something that exists [Tags: " + (tags ? tags : "Random GIF") + "]");
      }
    });
  }
};

Commands.imglist = {
  name: "imglist",
  help: "Prints the contents of the images directory to the channel.",
  level: 0,
  fn: function(bot, msg) {
    var fs = require("fs");
    var path = require("path");
    var ext = [".jpg", ".jpeg", ".gif", ".png"];
    var imgArray = [];
    fs.readdir("./images", function(err, dirContents) {
      for (var i = 0; i < dirContents.length; i++) {
        for (var o = 0; o < ext.length; o++) {
          if (path.extname(dirContents[i]) === ext[o]) {
            imgArray.push(dirContents[i]);
          }
        }
      }
      bot.reply(msg, imgArray);
    });
  }
};

Commands.stroke = {
  name: "stroke",
  help: "I'll stroke someones ego, how nice of me.",
  usage: "[First name][, [Last name]]",
  level: 0,
  fn: function(bot, msg, suffix) {
    var name;
    if (suffix) {
      name = suffix.split(" ");
      if (name.length === 1) {
        name = ["", name];
      }
    } else {
      name = ["Perpetu", "Cake"];
    }
    var request = require('request');
    request('http://api.icndb.com/jokes/random?escape=javascript&firstName=' + name[0] + '&lastName=' + name[1], function(error, response, body) {
      if (!error && response.statusCode == 200) {
        var joke = JSON.parse(body);
        bot.sendMessage(msg.channel, joke.value.joke);
      } else {
        Logger.log("warn", "Got an error: ", error, ", status code: ", response.statusCode);
      }
    });
  }
};

Commands.yomomma = {
  name: "yomomma",
  help: "I'll get a random yo momma joke for you.",
  level: 0,
  fn: function(bot, msg, suffix) {
    var request = require('request');
    request('http://api.yomomma.info/', function(error, response, body) {
      if (!error && response.statusCode == 200) {
        var yomomma = JSON.parse(body);
        bot.reply(msg, yomomma.joke);
      } else {
        Logger.log("warn", "Got an error: ", error, ", status code: ", response.statusCode);
      }
    });
  }
};

Commands.advice = {
  name: "advice",
  help: "I'll give you some great advice, I'm just too kind.",
  level: 0,
  fn: function(bot, msg, suffix) {
    var request = require('request');
    request('http://api.adviceslip.com/advice', function(error, response, body) {
      if (!error && response.statusCode == 200) {
        var advice = JSON.parse(body);
        bot.sendMessage(msg.reply + advice.slip.advice);
      } else {
        Logger.log("warn", "Got an error: ", error, ", status code: ", response.statusCode);
      }
    });
  }
};

Commands.yesno = {
  name: "yesno",
  help: "Ever wanted a gif displaying your (dis)agreement? Then look no further!",
  usage: "optional: [force yes/no/maybe]",
  level: 0,
  fn: function(bot, msg, suffix) {
    var request = require('request');
    request('http://yesno.wtf/api/?force=' + suffix, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        var yesNo = JSON.parse(body);
        bot.reply(msg, yesNo.image);
      } else {
        Logger.log("warn", "Got an error: ", error, ", status code: ", response.statusCode);
      }
    });
  }
};

Commands.urbandictionary = {
  name: "urbandictionary",
  help: "Ever wanted to know what idiots on the internet thinks something means? Here ya go!",
  usage: "[string]",
  level: 0,
  fn: function(bot, msg, suffix) {
    var request = require('request');
    request('http://api.urbandictionary.com/v0/define?term=' + suffix, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        var uD = JSON.parse(body);
        if (uD.result_type !== "no_results") {
          bot.reply(msg, suffix + ": " + uD.list[0].definition + ' "' + uD.list[0].example + '"');
        } else {
          bot.reply(msg, suffix + ": This is so screwed up, even Urban Dictionary doesn't have it in it's database");
        }
      } else {
        Logger.log("warn", "Got an error: ", error, ", status code: ", response.statusCode);
      }
    });
  }
};

Commands.fact = {
  name: "fact",
  help: "I'll give you some interesting facts!",
  level: 0,
  fn: function(bot, msg, suffix) {
    var request = require('request');
    var xml2js = require('xml2js');
    request("http://www.fayd.org/api/fact.xml", function(error, response, body) {
      if (!error && response.statusCode == 200) {
        //Logger.log("debug", body)
        xml2js.parseString(body, function(err, result) {
          bot.reply(msg, result.facts.fact[0]);
        });
      } else {
        Logger.log("warn", "Got an error: ", error, ", status code: ", response.statusCode);
      }
    });
  }
};

Commands.xkcd = {
  name: "xkcd",
  help: "I'll get a XKCD comic for you, you can define a comic number and I'll fetch that one.",
  usage: "[current, or comic number]",
  level: 0,
  fn: function(bot, msg, suffix) {
    var request = require('request');
    request('http://xkcd.com/info.0.json', function(error, response, body) {
      if (!error && response.statusCode == 200) {
        var xkcdInfo = JSON.parse(body);
        if (suffix) {
          var isnum = /^\d+$/.test(suffix);
          if (isnum) {
            if ([suffix] < xkcdInfo.num) {
              request('http://xkcd.com/' + suffix + '/info.0.json', function(error, response, body) {
                if (!error && response.statusCode == 200) {
                  xkcdInfo = JSON.parse(body);
                  bot.reply(msg, xkcdInfo.img);
                } else {
                  Logger.log("warn", "Got an error: ", error, ", status code: ", response.statusCode);
                }
              });
            } else {
              bot.reply(msg, "there are only " + xkcdInfo.num + " xkcd comics!");
            }
          } else {
            bot.reply(msg, xkcdInfo.img);
          }
        } else {
          var xkcdRandom = Math.floor(Math.random() * (xkcdInfo.num - 1)) + 1;
          request('http://xkcd.com/' + xkcdRandom + '/info.0.json', function(error, response, body) {
            if (!error && response.statusCode == 200) {
              xkcdInfo = JSON.parse(body);
              bot.reply(msg, xkcdInfo.img);
            } else {
              Logger.log("warn", "Got an error: ", error, ", status code: ", response.statusCode);
            }
          });
        }

      } else {
        Logger.log("warn", "Got an error: ", error, ", status code: ", response.statusCode);
      }
    });
  }
};

Commands.csgoprice = {
  name: "csgoprice",
  help: "I'll give you the price of a CS:GO skin.",
  usage: '[weapon "AK-47"] [skin "Vulcan"] [[wear "Factory New"] [stattrak "(boolean)"]] Quotes are important!',
  level: 0,
  fn: function(bot, msg, suffix) {
    if (!suffix) {
      bot.reply(msg, "enter a weapon query!");
      return;
    }
    skinInfo = suffix.split('"');
    var csgomarket = require('csgo-market');
    csgomarket.strictNameMode = false;
    csgomarket.getSinglePrice(skinInfo[1], skinInfo[3], skinInfo[5], skinInfo[7], function(err, skinData) {
      if (err) {
        Logger.log('error', err);
        bot.reply(msg, "that skin is so super secret rare, it doesn't even exist!");
      } else {
        if (skinData.success === true) {
          if (skinData.stattrak) {
            skinData.stattrak = "Stattrak";
          } else {
            skinData.stattrak = "";
          }
          var msgArray = ["Weapon: " + skinData.wep + " " + skinData.skin + " " + skinData.wear + " " + skinData.stattrak, "Lowest Price: " + skinData.lowest_price, "Number Available: " + skinData.volume, "Median Price: " + skinData.median_price, ];
          bot.reply(msg, msgArray);
        }
      }
    });
  }
};

Commands.dice = {
  name: "dice",
  help: "I'll roll some dice for you, handy!",
  usage: "[numberofdice]d[sidesofdice]",
  level: 0,
  fn: function(bot, msg, suffix) {
    var dice;
    if (suffix) {
      dice = suffix;
    } else {
      dice = "d6";
    }
    var request = require('request');
    request('https://rolz.org/api/?' + dice + '.json', function(error, response, body) {
      if (!error && response.statusCode == 200) {
        var roll = JSON.parse(body);
        bot.reply(msg, "your " + roll.input + " resulted in " + roll.result + " " + roll.details);
      } else {
        Logger.log("warn", "Got an error: ", error, ", status code: ", response.statusCode);
      }
    });
  }
};

Commands.fancyinsult = {
  name: "fancyinsult",
  help: "I'll insult your friends, in style.",
  level: 0,
  fn: function(bot, msg, suffix) {
    var request = require('request');
    request('http://quandyfactory.com/insult/json/', function(error, response, body) {
      if (!error && response.statusCode == 200) {
        var fancyinsult = JSON.parse(body);
        if (suffix === "") {
          bot.reply(msg, fancyinsult.insult);
          bot.deleteMessage(msg);
        } else {
          bot.reply(msg, suffix + ", " + fancyinsult.insult);
          bot.deleteMessage(msg);
        }
      } else {
        Logger.log("warn", "Got an error: ", error, ", status code: ", response.statusCode);
      }
    });
  }
};

Commands.imdb = {
  name: "imdb",
  help: "I'll search through IMDb for a movie matching your given tags, and post my finds in the channel.",
  usage: "[title]",
  level: 0,
  fn: function(bot, msg, suffix) {
    if (suffix) {
      var request = require('request');
      request('http://api.myapifilms.com/imdb/title?format=json&title=' + suffix + '&token=' + ConfigFile.api_keys.myapifilms_token, function(error, response, body) {
        if (!error && response.statusCode == 200) {
          var imdbInfo = JSON.parse(body);
          imdbInfo = imdbInfo.data.movies[0];
          if (imdbInfo) {
            //Date snatching
            var y = imdbInfo.releaseDate.substr(0, 4),
              m = imdbInfo.releaseDate.substr(4, 2),
              d = imdbInfo.releaseDate.substr(6, 2);
            var msgArray = [imdbInfo.title, imdbInfo.plot, " ", "Released on: " + m + "/" + d + "/" + y, "Rated: " + imdbInfo.rated + imdbInfo.rating + "/10"];
            var sendArray = [imdbInfo.urlIMDB, msgArray];
            for (var i = 0; i < sendArray.length; i++) {
              bot.sendMessage(msg.channel, sendArray[i]);
            }
          } else {
            bot.sendMessage(msg.channel, "Search for " + suffix + " failed!");
          }
        } else {
          Logger.log("warn", "Got an error: ", error, ", status code: ", response.statusCode);
        }
      });
    } else {
      bot.sendMessage(msg.channel, "Usage: `imdb [title]`");
    }
  }
};

Commands["8ball"] = {
  name: "8ball",
  help: "I'll function as an magic 8 ball for a bit and answer all of your questions! (So long as you enter the questions as suffixes.)",
  usage: "<question>",
  level: 0,
  fn: function(bot, msg, suffix) {
    var request = require('request');
    request('https://8ball.delegator.com/magic/JSON/0', function(error, response, body) {
      if (!error && response.statusCode == 200) {
        var eightBall = JSON.parse(body);
        bot.sendMessage(msg.channel, eightBall.magic.answer + ", " + msg.sender);
      } else {
        Logger.log("warn", "Got an error: ", error, ", status code: ", response.statusCode);
      }
    });
  }
};

Commands.catfacts = {
  name: "catfacts",
  help: "I'll give you some interesting facts about cats!",
  level: 0,
  fn: function(bot, msg, suffix) {
    var request = require('request');
    request('http://catfacts-api.appspot.com/api/facts', function(error, response, body) {
      if (!error && response.statusCode == 200) {
        var catFact = JSON.parse(body);
        bot.reply(msg, catFact.facts[0]);
      } else {
        Logger.log("warn", "Got an error: ", error, ", status code: ", response.statusCode);
      }
    });
  }
};

Commands.help = {
  name: "help",
  help: "You're looking at it right now.",
  level: 0,
  fn: function(bot, msg, suffix) {
    var msgArray = [];
    var commandnames = []; // Build a array of names from commands.
    if (!suffix) {
      for (index in Commands) {
        commandnames.push(Commands[index].name);
      }
      msgArray.push("These are the currently available commands, use `" + ConfigFile.bot_settings.cmd_prefix + "help <command_name>` to learn more about a specific command.");
      msgArray.push("");
      msgArray.push(commandnames.join(", "));
      msgArray.push("");
      msgArray.push("If you have any questions, or if you don't get something, contact <@107904023901777920> or <@110147170740494336>");
      if (ConfigFile.bot_settings.help_mode === "private") {
        bot.sendMessage(msg.author, msgArray);
        Logger.debug("Send help via DM.");
        if (msg.channel.server) {
          bot.sendMessage(msg.channel, "Ok " + msg.author + ", I've sent you a list of commands via DM.");
        }
      } else if (ConfigFile.bot_settings.help_mode === "channel") {
        bot.sendMessage(msg.channel, msgArray);
        Logger.debug("Send help to channel.");
      } else {
        Logger.error("Config File error! Help mode is incorrectly defined!");
        bot.sendMessage(msg.channel, "Sorry, my owner didn't configure me correctly!");
      }
    }
    if (suffix) {
      if (Commands[suffix]) { // Look if suffix corresponds to a command
        var commando = Commands[suffix]; // Make a varialbe for easier calls
        msgArray = []; // Build another message array
        msgArray.push("**Command:** `" + commando.name + "`"); // Push the name of the command to the array
        msgArray.push(""); // Leave a whiteline for readability
        if (commando.hasOwnProperty("usage")) { // Push special message if command needs a suffix.
          msgArray.push("**Usage:** `" + ConfigFile.bot_settings.cmd_prefix + commando.name + " " + commando.usage + "`");
        } else {
          msgArray.push("**Usage:** `" + ConfigFile.bot_settings.cmd_prefix + commando.name + "`");
        }
        msgArray.push("**Description:** " + commando.help); // Push the extendedhelp to the array.
        if (commando.hasOwnProperty("nsfw")) { // Push special message if command is restricted.
          msgArray.push("**This command is NSFW, so it's restricted to certain channels and DM's.**");
        }
        if (commando.hasOwnProperty("timeout")) { // Push special message if command has a cooldown
          msgArray.push("**This command has a cooldown of " + commando.timeout + " seconds.**");
        }
        if (commando.hasOwnProperty('level')) {
          msgArray.push("**Needed access level:** " + commando.level); // Push the needed access level to the array
        }
        if (commando.hasOwnProperty('music')) { // Push music message if command is musical.
          msgArray.push("**This is a music related command, you'll need a role called** `Radio Master` **to use this command.**");
        }
        if (suffix == "meme") { // If command requested is meme, print avalible meme's
          msgArray.push("");
          var str = "**Currently available memes:\n**";
          var meme = require("./memes.json");
          for (var m in meme) {
            str += m + ", ";
          }
          msgArray.push(str);
        }
        if (ConfigFile.bot_settings.help_mode === "private") {
          bot.sendMessage(msg.author, msgArray);
          Logger.debug("Send suffix help via DM.");
        } else if (ConfigFile.bot_settings.help_mode === "channel") {
          bot.sendMessage(msg.channel, msgArray);
          Logger.debug("Send suffix help to channel.");
        } else {
          Logger.error("Config File error! Help mode is incorrectly defined!");
          bot.sendMessage(msg.channel, "Sorry, my owner didn't configure me correctly!");
        }
      } else {
        bot.sendMessage(msg.channel, "There is no **" + suffix + "** command!");
      }
    }
  }
};

exports.Commands = Commands;
