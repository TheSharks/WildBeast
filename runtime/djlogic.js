var Discord = require("discord.js"),
  bot = new Discord.Client(),
  Logger = require("./logger.js").Logger,
  request = require("request"),
  boundChannel = false,
  stream = false,
  vol = 0.50,
  Config = require("../config.json");

exports.joinVoice = function(bot, message) {
  if (Config.bot_settings.disable_music_commands === true) bot.reply(message, "music commands are disabled.");
  if (boundChannel) return;
  var channelToJoin = spliceArguments(message.content)[1];
  for (var channel of message.channel.server.channels) {
    if (channel instanceof Discord.VoiceChannel) {
      if (!channelToJoin || channel.name === channelToJoin) {
        boundChannel = message.channel;
        bot.reply(message, `Binding to text channel <#${boundChannel.id}> and voice channel **${channel.name}** \`(${channel.id})\``);
        bot.joinVoiceChannel(channel);
        break;
      }
    }
  }
};

exports.playYouTube = function(bot, message, query) {
  if (Config.bot_settings.disable_music_commands === true) bot.reply(message, "music commands are disabled.");
  if (!message.channel.equals(boundChannel)) return;
  var YT = require('ytdl-core');
  var fs = require('fs');
  var link = 'http://www.youtube.com/watch?v=';
  var name;
  var ytdl = YT(link + query, { quality: 140}); // The quality of 140 assures we only download the music stream
  bot.reply(message, "Resolving " + query);
  ytdl.on('error', function(err){
    bot.reply(message, "That doesn't work, " + err);
    return;
  });
  YT.getInfo(link + query, function(err, info){
    if (err) {
      return;
    }
    if (info) name = info.title;
  });
    ytdl.pipe(fs.createWriteStream('sound.mp4'));
    ytdl.on('finish', function(){
      bot.sendMessage(message.channel, "Preparing to play " + name);
      bot.voiceConnection.playFile('./sound.mp4', {
        volume: 0.50,
        stereo: true
      }, function(err, str){
        if (err) {
          Logger.error("Error while piping YouTube stream! " + err);
        } else if (str) {
          bot.sendMessage(message.channel, "Playing " + message.sender + "'s request right now!");
        }
      });
  });
};

exports.playMusicURL = function(bot, message) {
  if (Config.bot_settings.disable_music_commands === true) bot.reply(message, "music commands are disabled.");
  var url = message.content.split(" ")[1];
  bot.voiceConnection.playFile(url, {
    volume: 0.50,
    stereo: true
  });
  bot.reply(message, "Now playing " + url);
  bot.voiceConnection.emit("end");
  bot.sendMessage("Stream has ended");
};

exports.stopPlaying = function(message) {
  if (!message.channel.equals(boundChannel)) return;
  if (bot.voiceConnection) bot.voiceConnection.stopPlaying();
  boundChannel.sendMessage("Stream has ended");
  stream = false;
};

exports.leaveVoice = function(bot, message) {
  if (!message.channel.equals(boundChannel)) return;
  if (!boundChannel)
    bot.sendMessage(message, "Can't leave what I'm not in!");
  if (!boundChannel) return;
  bot.reply(message, `Unbinding from <#${boundChannel.id}> and destroying voice connection`);
  bot.leaveVoiceChannel();
  boundChannel = false;
  stream = false;
  return;
};

function spliceArguments(message, after) {
  after = after || 1;
  var rest = message.split(' ');
  var removed = rest.splice(0, after);
  return [removed.join(' '), rest.join(' ')];
}
