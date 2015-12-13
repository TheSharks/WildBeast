var Discord = require("discord.js");
var bot = new Discord.Client();
var ConfigFile = require("../config.json");

var Commands = [];

Commands.ping = {
  name: "ping",
  help: "I'll reply to you with pong!",
  fn: function(bot, msg){
    bot.sendMessage(msg.channel, "Pong!");
}};

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
