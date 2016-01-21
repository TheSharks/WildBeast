var Discord = require("discord.js"),
  bot = new Discord.Client(),
  request = require("request"),
  boundChannel = false,
  stream = false,
  vol = 0.25;

exports.joinVoice = function(bot, message) {
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

exports.playMusicURL = function(bot, message) {
  var url = message.content.split(" ")[1];
  bot.voiceConnection.playFile(url, {
    volume: 0.25,
    stereo: true
  });
  bot.reply(message, "Now playing " + url);
  bot.voiceConnection.emit("end");
  bot.sendMessage("Stream has ended");
};

exports.stopPlaying = function(message) {
  if (!message.channel.equals(boundChannel)) return;
  stopped();
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

function stopped() {
  if (bot.internal.voiceConnection) bot.internal.voiceConnection.stopPlaying();
  boundChannel.sendMessage("Stream has ended");
}
