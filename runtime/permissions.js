var ConfigFile = require("../config.json");

exports.GetLevel = function(){
 // Not yet implemented
 reply = 0;
};

exports.GetNSFW = function(){
  // Not yet implemented
  reply = true;
};

exports.SetMaster = function(){
  // Not yet implemented
  reply = ConfigFile.masterUser;
};

exports.SetGlobal = function(){
  // Not yet implemented
  reply = "success";
};

exports.MakeStorage = function(){
  // Not yet implemented
  reply = "success";
};

exports.SetLevel = function(){
  // Not yet implemented
  reply = "success";
};

exports.SetNSFW = function(){
  // Not yet implemented
  reply = "success";
};
