var Discord = require("discord.js");
var bot = new Discord.Client();
var ConfigFile = require("../config.json");

var Delete = [];

Delete.command = {
  fn: function(bot, msg){
  var bot_permissions = msg.channel.permissionsOf(bot.user);
    if (bot_permissions.hasPermission("manageMessages")) {
      bot.deleteMessage(msg);
      return;
    } else {
      bot.sendMessage(msg.channel, "*This works best when I have the permission to delete messages!*");
    }
}};

Delete.purge ={
  fn: function(bot, msg){
    var bot_permissions = msg.channel.permissionsOf(bot.user);
      if (bot_permissions.hasPermission("manageMessages")){
          bot.deleteMessage(msg);
        return;
      } else {
        bot.sendMessage(msg.channel, "*I can't do that!*");
      }
  }
};

exports.Delete = Delete;
