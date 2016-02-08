/*
Attention contributors, please adhere to these set loglevels (loglev)
when sending information to the debug log or the verbose log.

Debug mode:
info
warn
error
critical
fail
debug (please only use for stuff that won't fit in any of the other categories.)

Verbose logging:
info
response
silly
verbose (please only use for stuff that won't fit in any of the other categories.)
*/

var Debug = require("./logger.js").DebugModeLog,
  Verbose = require("./logger.js").VerboseModeLog,
  Config = require("../config.json");

exports.prepareDebug = function() {
  if (Config.bot_settings.debug_mode === false) return;
  console.log("Warning! Debug mode can be dangerous, be warned!");
  Debug.debug("Script has been (re)started.");
  Debug.debug("Assuming operator is fine with debug mode active.");
  Debug.debug("Configuration information:");
  Debug.debug("Master user: " + Config.permissions.masterUser);
  Debug.debug("Level 1 user: " + Config.permissions.level1);
  Debug.debug("Level 2 user: " + Config.permissions.level2);
  Debug.debug("Level 3 user: " + Config.permissions.level3);
  Debug.debug("Help mode: " + Config.bot_settings.help_mode);
  Debug.debug("Command prefix: " + Config.bot_settings.cmd_prefix);
  Debug.debug("=================================================================================");
};

exports.debuglogSomething = function(cmd, text, loglev) {
  if (Config.bot_settings.debug_mode === false) return;
  var d = new Date();
  var timestamp = d.toUTCString();
  Debug.debug(cmd + " logged something at " + timestamp + " with level <" + loglev + ">");
  Debug.debug(text);
  Debug.debug("=================================================================================");
};

exports.verboselogSomething = function(cmd, text, loglev) {
  if (Config.bot_settings.verbose_logging === false) return;
  var d = new Date();
  var timestamp = d.toUTCString();
  Verbose.debug(cmd + " logged something at " + timestamp + " with level <" + loglev + ">");
  Verbose.debug(text);
  Verbose.debug("=================================================================================");
};
