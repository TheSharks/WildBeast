/*
TODO: Rewrite this entire file to support multiple voice connections
TODO: Make bindings unique to server instead of channel
TODO: Remove timeouts when script supports multiple voice connections
IDEA: Make playlists save to a file, and make them recall with a code, so users dont need to make YouTube playlists
*/

var Discord = require("discord.js"),
  bot = new Discord.Client(),
  Logger = require("./logger.js").Logger,
  request = require("request"),
  time,
  pretime,
  counter = 0,
  playlistid = [],
  status = null,
  vidarray = [],
  playlistinfo = [],
  playlistuser = [],
  boundChannel = false,
  stream = false,
  vol = 0.50,
  Config = require("../config.json");

exports.joinVoice = function(bot, message) {
  if (Config.bot_settings.disable_music_commands === true) {
    bot.reply(message, "music commands are disabled.");
    return;
  }
  if (boundChannel) return;
  var channelToJoin = spliceArguments(message.content)[1];
  status = 'Waiting';
  for (var channel of message.channel.server.channels) {
    if (channel instanceof Discord.VoiceChannel) {
      if (!channelToJoin || channel.name === channelToJoin) {
        boundChannel = message.channel;
        bot.reply(message, `binding to text channel <#${boundChannel.id}> and voice channel **${channel.name}** \`(${channel.id})\``);
        bot.joinVoiceChannel(channel);
        break;
      }
    }
  }
  if (Config.bot_settings.music_timeouts === true) {
    time = setTimeout(function() {
      if (status === 'Waiting') {
        bot.sendMessage(message.channel, "The waiting music has ended, but the playlist has not been started, destroying connection.");
        if (bot.voiceConnection) {
          bot.leaveVoiceChannel();
        }
        playlistid = [];
        playlistinfo = [];
        playlistuser = [];
        boundChannel = false;
        stream = false;
        return;
      }
    }, 186000);
  }
  setTimeout(function() {
    if (bot.voiceConnection !== null) {
      bot.voiceConnection.playFile('./music/waitmusic.mp3', {}); // Play waitng music because why not
    }
  }, 1000); // Wait a bit for the voiceConnection object to become avalible
};

exports.playlistAdd = function(bot, message, suffix) {
  if (Config.bot_settings.disable_music_commands === true) {
    bot.reply(message, "music commands are disabled.");
    return;
  }
  if (!bot.voiceConnection) {
    bot.reply(message, "not in voice right now.");
    return;
  }
  if (!message.channel.equals(boundChannel)) return;
  if (playlistid.length === 20) {
    bot.reply(message, "the playlist is full, sorry.");
    return;
  }
  if (!suffix) {
    bot.sendMessage(message.channel, "Please specify a video ID!");
    return;
  }
  if (suffix.length > 12) {
    Logger.debug("Assuming playlist.");
    var yt = require("youtube-api");
    var ammount = 20 - playlistid.length;
    yt.authenticate({
      type: 'key',
      key: Config.api_keys.google_key
    });
    yt.playlistItems.list({
      part: 'snippet',
      pageToken: [],
      maxResults: ammount,
      playlistId: suffix,
    }, function(err, data) {
      if (err) {
        Logger.debug("Playlist failiure, " + err);
        bot.sendMessage(message.channel, "Something went wrong, try again.");
        return;
      } else if (data) {
        for (var x in data.items) {
          counter++;
          playlistid.push(data.items[x].snippet.resourceId.videoId);
          playlistinfo.push(data.items[x].snippet.title);
          playlistuser.push(message.author.username);
          var link = 'http://www.youtube.com/watch?v=';
          var YT = require('ytdl-core');
          YT.getInfo(link + playlistid[playlistid.length - 1], function(err, info) {
            if (err) {
              Logger.debug("Error while evaluating playlist videos.");
              return;
            } else if (info) {
              if (info.length_seconds > 900) { // 15 minutes translated into seconds
                counter--;
                playlistid.splice(playlistid.length - 1, 1);
                playlistinfo.splice(playlistinfo.length - 1, 1);
                playlistuser.splice(playlistuser.length - 1, 1);
                Logger.debug("Ignored video longer than 15 minutes.");
                return;
              } else {
                return;
              }
            }
          });
        }
        if (status === 'Waiting') {
          playlistPlay(bot, message);
          status = null;
        }
        bot.reply(message, "done! Added " + counter + " videos to the queue!");
        if (Config.bot_settings.music_timeouts === true) {
          clearTimeout(time);
        }
        counter = 0;
      }
    });
  } else {
    var YT = require('ytdl-core');
    var link = 'http://www.youtube.com/watch?v=';
    YT.getInfo(link + suffix, function(err, info) {
      if (err) {
        bot.reply(message, "Incorrect video ID, I only accept YouTube videos!");
        return;
      }
      if (info) {
        if (info.length_seconds > 900) { // 15 minutes translated into seconds
          bot.reply(message, "too long, videos can be max 15 minutes long!");
          return;
        }
        playlistid.push(suffix);
        playlistinfo.push(info.title);
        playlistuser.push(message.author.username);
        bot.reply(message, "added **" + info.title + "** to play at position " + playlistid.length);
        if (status === 'Waiting') {
          playlistPlay(bot, message);
          status = null;
        }
        if (Config.bot_settings.music_timeouts === true) {
          clearTimeout(time);
        }
      }
    });
  }
};

exports.returnNowPlaying = function(bot, message) {
  if (Config.bot_settings.disable_music_commands === true) {
    bot.reply(message, "music commands are disabled.");
    return;
  }
  if (!bot.voiceConnection) {
    bot.reply(message, "not in voice right now.");
  }
  if (!message.channel.equals(boundChannel)) return;
  bot.sendMessage(message.channel, "Currently playing http://www.youtube.com/watch?v=" + playlistid[0] + " for " + playlistuser[0]);
};

exports.playlistFetch = function(bot, message) {
  if (Config.bot_settings.disable_music_commands === true) {
    bot.reply(message, "music commands are disabled.");
    return;
  }
  if (!bot.voiceConnection) {
    bot.reply(message, "not in voice right now.");
  }
  if (!message.channel.equals(boundChannel)) return;
  var ar = [];
  if (playlistid.length === 0) ar.push("The playlist is empty :(");
  for (i = 0; i < playlistid.length; i++) {
    ar.push((i + 1) + ". **" + playlistinfo[i] + "** requested by " + playlistuser[i]);
    if (i === 9) break;
  }
  bot.sendMessage(message.channel, ar);
};

function playlistPlay(bot, message) {
  var YT = require('ytdl-core');
  var fs = require('fs');
  var link = 'http://www.youtube.com/watch?v=';
  var ytdl = YT(link + playlistid[0], {
    quality: 140
  }); // The quality of 140 assures we only download the music stream
  ytdl.on('error', function() {
    Logger.debug("YTDL error, could be because of undefined requests.");
    return;
  });
  bot.voiceConnection.playRawStream(ytdl, { // Stream the video directly instead of buffering it to the disk.
    volume: 0.50,
    stereo: true
  }, function(err, str) {
    if (err) {
      Logger.error("Error while piping YouTube stream! " + err);
      Logger.debug('Failiure to stream ' + playlistinfo[0] + ' to Discord.');
    } else if (str) {
      bot.setStatus('online', playlistinfo[0]);
      Logger.debug('Streaming ' + playlistinfo[0] + ' successful.');
    }
    str.on('end', function() {
      playlistid.splice(0, 1);
      playlistinfo.splice(0, 1);
      playlistuser.splice(0, 1);
      if (playlistid[0] === undefined) {
        bot.sendMessage(message.channel, "The playlist is finished, destroying voice connection.");
        bot.setStatus("online", null);
        bot.leaveVoiceChannel();
        boundChannel = false;
        stream = false;
        playlistid = [];
        playlistinfo = [];
        playlistuser = [];
        return;
      } else {
        playlistPlay(bot, message);
      }
    });
  });
}

exports.expSkip = function(bot, message) {
  if (Config.bot_settings.disable_music_commands === true) {
    bot.reply(message, "music commands are disabled.");
    return;
  }
  if (!bot.voiceConnection) {
    bot.reply(message, "not in voice right now.");
  }
  if (!message.channel.equals(boundChannel)) return;
  if (playlistid.length === 1) {
    bot.reply(message, "Ending playlist, as the skipped song is the last one in the playlist.");
    boundChannel = false;
    stream = false;
    bot.leaveVoiceChannel();
    playlistid = [];
    playlistinfo = [];
    playlistuser = [];
    return;
  }
  bot.reply(message, "skipping...");
  bot.voiceConnection.stopPlaying();
};

exports.setVolume = function(bot, message, suffix) {
  if (boundChannel) {
    if (isNaN(suffix) || suffix > 1) {
      bot.sendMessage(message.channel, "The volume must be a number between 0 and 1. ex: 0.5");
    } else {
      vol = suffix;
      bot.sendMessage(message.channel, "Volume has been set to " + suffix);
      bot.voiceConnection.setVolume(vol);
    }
  }
};

exports.checkPerms = function(server, author, callback) {
  return new Promise(function(resolve, reject) {
    try {
      if (Config.permissions.masterUser.indexOf(author.id) > -1) {
        resolve(1);
        return;
      }
      var array = server.rolesOfUser(author);
      for (i = 0; i < array.length; i++) {
        if (array[i].name === "Radio Master") {
          resolve(1);
          return;
        }
      }
      reject('No permission');
    } catch (e) {
      reject(e);
    }
  });
};

exports.stopPlaying = function(bot, message) {
  if (Config.bot_settings.disable_music_commands === true) {
    bot.reply(message, "music commands are disabled.");
    return;
  }
  if (!message.channel.equals(boundChannel)) return;
  if (bot.voiceConnection) {
    bot.voiceConnection.stopPlaying();
  }
  bot.setStatus("online", null);
  boundChannel.sendMessage("Stream has ended");
  stream = false;
};

exports.checkIfAvailable = function(bot, message) {
  if (Config.bot_settings.disable_music_commands === true) {
    bot.reply(message, "music commands are disabled.");
    return;
  }
  if (bot.voiceConnection) bot.sendMessage(message.channel, "I'm currently streaming music on another server or voice channel.");
  if (!bot.voiceConnection) bot.sendMessage(message.channel, "I'm available to play music right now, use `join-voice <channel-name>` to initiate me!");
};

exports.leaveVoice = function(bot, message) {
  status = null;
  clearTimeout(pretime);
  clearTimeout(time);
  if (!message.channel.equals(boundChannel)) return;
  if (!boundChannel)
    bot.sendMessage(message, "can't leave what I'm not in!");
  if (!boundChannel) return;
  clearTimeout(time);
  bot.reply(message, `unbinding from <#${boundChannel.id}> and destroying voice connection`);
  bot.leaveVoiceChannel();
  bot.setStatus("online", null);
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
