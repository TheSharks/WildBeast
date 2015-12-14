var Discord = require("discord.js");
var bot = new Discord.Client();
var ConfigFile = require("../config.json");
var imgDirectory = require("../config.json").image_folder;
var Delete = require("./deletion.js").Delete;

var Commands = [];

Commands.ping = {
  name: "ping",
  help: "I'll reply to you with pong!",
  fn: function(bot, msg){
    bot.sendMessage(msg.channel, "Pong!");
}};

Commands.status = {
  name: "status",
  help: "I'll get some info about me, like uptime and currently connected servers.",
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
