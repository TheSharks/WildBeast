/*
WARNING, This file is intended to help users upgrade from gamma.7 to 2.0.0
It will make a database document for every server and user within the cache
This does NOT need to be called without the intention to upgrade the database
*/

var Discord = require('discord.js'),
  bot = new Discord.Client(),
  Config = require('../config.json'),
  Permissions = require('./permissions.js'),
  UserDB = require('./user_nsa.js'),
  Customize = require('./customization.js'),
  Logger = require('./logger.js').Logger;

exports.databaseSystem = function(bot) {
  if (Config.bot_settings.upgrade_mode === false) return;
  Logger.warn("WARNING! Upgrade mode is enabled! This might take a long time to fully upgrade the database, if you have already upgraded the database, stop now and turn upgrade_mode off!");
  Logger.info('Upgrading users...');
  Logger.info('Upgrading servers...');
  for (i = 0; i < bot.servers.length; i++) {
    if (bot.servers[i] === null) {
      Logger.info('Servers upgraded!');
      break;
    }
    Permissions.initializeServer(bot.servers[i]);
    Customize.initializeServer(bot.servers[i]);
  }
  for (i = 0; i < bot.users.length; i++) {
    if (bot.users[i] === null) {
      Logger.info('Users upgraded!');
      break;
    }
    UserDB.trackNewUser(bot.users[i]);
  }
  Logger.info('The entire database has been upgraded to use NeDB, the permissions set in gamma.7 are not transferred.');
};
