var Discord = require("discord.js");
var bot = new Discord.Client();
var ConfigFile = require("../config.json");
var Logger = require("./logger.js").Logger;
var Permissions = require("./permissions.js");
var imgDirectory = require("../config.json").image_folder;
var Delete = require("./deletion.js").Delete;

var Commands = [];

Commands.ping = {
  name: "ping",
  help: "I'll reply to you with pong!",
  level: 0,
  fn: function(bot, msg){
    bot.sendMessage(msg.channel, "Pong!");
}};

Commands.testnsfw = {
  name: "testnsfw",
  help: "This is a test command.",
  level: 0,
  nsfw: true,
  fn: function(bot, msg){
    bot.sendMessage(msg.channel, "Executed!");
}};

Commands.test1 = {
  name: "test1",
  help: "This is a test command.",
  level: 1,
  fn: function(bot, msg){
    bot.sendMessage(msg.channel, "Executed!");
}};

Commands.test2 = {
  name: "test2",
  help: "This is a test command.",
  level: 2,
  fn: function(bot, msg){
    bot.sendMessage(msg.channel, "Executed!");
}};

Commands.test3 = {
  name: "test3",
  help: "This is a test command.",
  level: 3,
  fn: function(bot, msg){
    bot.sendMessage(msg.channel, "Executed!");
}};

Commands.setlevel = {
  name: "setlevel",
  help: "This changes the permission level of an user.",
  level: 3,
  fn: function(bot, msg, suffix){
		if (!msg.channel.server) {
			bot.sendMessage(msg.channel, "I can't do that in a PM!");
			return;
		}
		if (isNaN(suffix[0])) {
			bot.reply(msg.channel, "your first param is not a number!");
			return;
		}
		if (msg.mentions.length === 0) {
			bot.reply(msg.channel, "please mention the user(s) you want to set the permission level of.");
			return;
		}
		Permissions.getLevel(msg.author, function(err, level) {
			if (err) {
        bot.sendMessage(msg.channel, "Help! Something went wrong!");
        return;
      }
			if (suffix[0] > level) {
				bot.reply(msg.channel, "you can't set a user's permissions higher than your own!");
				return;
			}
		});
		msg.mentions.map(function(user) {
			Permissions.setLevel(msg.channel.server.id, user, suffix[0], function(err, level) {
				if (err) {
          bot.sendMessage(msg.channel, "Help! Something went wrong!");
          return;
        }
			});
		});
		bot.sendMessage(msg.channel, "Alright! The permission levels have been set successfully!");
}};

Commands.setnsfw = {
  name: "setnsfw",
  help: "This changes if the channel allows NSFW commands.",
  usage: "<on | off>",
  level: 3,
  fn: function(bot, msg, suffix){
		if (!msg.channel.server) {
			bot.sendMessage(msg.channel, "NSFW commands are always allowed in DM's.");
			return;
		}
		if (suffix[0] === "on" || suffix[0] === "off") {
			Permissions.setNSFW(msg.channel, suffix[0], function(err, allow) {
				if (err) {
          bot.reply(msg.channel, "I've failed to set NSFW flag!");
        }
				if (allow === "on") {
					bot.sendMessage(msg.channel, "NSFW commands are now allowed for " + message.channel);
				}
				else if (allow === "off") {
					bot.sendMessage(msg.channel, "NSFW commands are now disallowed for " + message.channel);
				}
				else {
					bot.reply(msg.channel, "I've failed to set NSFW flag!");
				}
			});
		}
}};

Commands.meme = {
  name: "meme",
  help: "I'll create a meme with your suffixes!",
  usage: '<memetype> "<Upper line>" "<Bottom line>" **Quotes are important!**',
  level: 0,
  fn: function(bot, msg, suffix){
    var tags = msg.content.split('"');
    var memetype = tags[0].split(" ")[1];
    var meme = require("./memes.json");
    //bot.sendMessage(msg.channel,tags);
    var Imgflipper = require("imgflipper");
    var imgflipper = new Imgflipper(ConfigFile.imgflip_username, ConfigFile.imgflip_password);
    imgflipper.generateMeme(meme[memetype], tags[1] ? tags[1] : "", tags[3] ? tags[3] : "", function(err, image) {
      //CmdErrorLog.log("debug", arguments);
      bot.sendMessage(msg.channel, image);
      if (!msg.channel.server){return;}
      Delete.command.fn(bot, msg);
});}};

Commands.status = {
  name: "status",
  help: "I'll get some info about me, like uptime and currently connected servers.",
  level: 0,
  fn: function(bot, msg){
    var msgArray = [];
    msgArray.push("Hello, I'm " + bot.user + ", nice to meet you!");
    msgArray.push("I'm used in " + bot.servers.length + " servers, and in " + bot.channels.length + " channels.");
    msgArray.push("My uptime is " + (Math.round(bot.uptime / (1000 * 60 * 60))) + " hours, " + (Math.round(bot.uptime / (1000 * 60)) % 60) + " minutes, and " + (Math.round(bot.uptime / 1000) % 60) + " seconds.");
    bot.sendMessage(msg.channel, msgArray);
}};

Commands.iff = {
  name: "iff",
  help: "''**I**mage **F**rom **F**ile'', I'll get a image from the image folder for you and upload it to the channel.",
  usage: "<image>",
  level: 0,
  fn: function(bot, msg, suffix){
    var fs = require("fs");
    var path = require("path");
    var ext = [".jpg", ".jpeg", ".gif", ".png"];
    var imgArray = [];
    fs.readdir(imgDirectory, function(err, dirContents) {
      for (var i = 0; i < dirContents.length; i++) {
        for (var o = 0; o < ext.length; o++) {
          if (path.extname(dirContents[i]) === ext[o]) {
            imgArray.push(dirContents[i]);
          }
        }
      }
      if (imgArray.indexOf(suffix) !== -1) {
        bot.sendFile(msg.channel, "./images/" + suffix);
        if (!msg.channel.server){return;}
        Delete.command.fn(bot, msg);
        } else {
          bot.sendMessage(msg.channel, "*Invalid input!*");
        }
    });
}};

Commands.imglist = {
  name: "imglist",
  help: "Prints the contents of the images directory to the channel.",
  level: 0,
  fn: function(bot, msg){
    var fs = require("fs");
    var path = require("path");
    var imgArray = [];
    fs.readdir(imgDirectory, function(err, dirContents) {
      for (var i = 0; i < dirContents.length; i++) {
        for (var o = 0; o < ext.length; o++) {
          if (path.extname(dirContents[i]) === ext[o]) {
            imgArray.push(dirContents[i]);
          }
        }
      }
      bot.sendMessage(msg.channel, imgArray);
    });
    }
};

Commands.help = {
  name: "help",
  help: "You're looking at it right now.",
  level: 0,
  fn: function(bot, msg, suffix){
    var msgArray = [];
    var commandnames = []; // Build a array of names from commands.
    if (!suffix) {
      for (index in Commands) {
        commandnames.push(Commands[index].name);
      }
      msgArray.push("These are the currently avalible commands, use `" + ConfigFile.cmd_prefix + "help <command_name>` to learn more about a specific command.");
      msgArray.push("");
      msgArray.push(commandnames.join(", "));
      msgArray.push("");
      msgArray.push("If you have any questions, or if you don't get something, contact <@107904023901777920> or <@110147170740494336>");
      bot.sendMessage(msg.author, msgArray);
      if (msg.channel.server) {
        bot.sendMessage(msg.channel, "Ok " + msg.author + ", I've send you a list of commands via DM.");
      }
    }
    if (suffix) {
      if (Commands[suffix]) { // Look if suffix corresponds to a command
        var commando = Commands[suffix]; // Make a varialbe for easier calls
        msgArray = []; // Build another message array
        msgArray.push("**Command:** `" + commando.name + "`"); // Push the name of the command to the array
        msgArray.push(""); // Leave a whiteline for readability
        if (commando.hasOwnProperty("usage")) { // Push special message if command needs a suffix.
          msgArray.push("**Usage:** `" + ConfigFile.cmd_prefix + commando.name + " " + commando.usage + "`");
        } else {
          msgArray.push("**Usage:** `" + ConfigFile.cmd_prefix + commando.name + "`");
        }
        msgArray.push("**Description:** " + commando.help); // Push the extendedhelp to the array.
        if (commando.hasOwnProperty("adminOnly")) { // Push special message if command is restricted.
          msgArray.push("**This command is restricted to admins.**");
        }
        if (commando.hasOwnProperty("timeout")) { // Push special message if command has a cooldown
          msgArray.push("**This command has a cooldown of " + commando.timeout + " seconds.**");
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
        bot.sendMessage(msg.author, msgArray); // Send the array to the user
      } else {
        bot.sendMessage(msg.channel, "There is no **" + suffix + "** command!");
      }
}}};

exports.Commands = Commands;
