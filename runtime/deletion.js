var Discord = require("discord.js");
var bot = new Discord.Client();
var ConfigFile = require("../config.json");

exports.command = function(bot, msg) {
  var bot_permissions = msg.channel.permissionsOf(bot.user);
    if (bot_permissions.hasPermission("manageMessages")) {
      bot.deleteMessage(msg);
      return;
    } else {
      bot.sendMessage(msg.channel, "*This works best when I have the permission to delete messages!*");
    }
};

exports.purge = function(bot, msg) {
    var bot_permissions = msg.channel.permissionsOf(bot.user);
      if (bot_permissions.hasPermission("manageMessages")){
        bot.getChannelLogs(msg.channel, suffix, function(error, messages){
          if (error){
            bot.sendMessage(msg.channel, "Something went wrong while fetching logs.");
            return;
          } else {
            CmdErrorLog.info("Beginning purge...");
            var todo = messages.length,
            delcount = 0;
            for (msg of messages){
              bot.deleteMessage(msg);
              todo--;
              delcount++;
            if (todo === 0){
              bot.sendMessage(msg.channel, "Done! Deleted " + delcount + " messages.");
              CmdErrorLog.info("Ending purge");
              return;
              }}
            }}
      );} else {
        bot.sendMessage(msg.channel, "*I can't do that!*");
      }
};
