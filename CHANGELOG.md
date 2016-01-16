## 2.0.0-beta.5
Fixes several problems caused by 2.0.0-beta.4   
Added an *incomplete* server defaulting system.   
Added `setstatus`.     
Changed the fixed length of `cmd_prefix` to a dynamic length.   
Changed the fixed character prefix to switch to mention activation if desired.   

## 2.0.0-beta.4
Fixed `myapifilms_token` not existing.  
Fixed problems with `++setowner`.  
Added `debug_mode` and `verbose_logging`. *(Note, only enable these on request of the devs!)*   
Added a config value that'll change the way `++help` functions.  
Updated the layout of `config.json`, **meaning that users need to remake their config files.**

## 2.0.0-beta.3
Fixed `giphy.js` not having requires.  
Fixed `suffix` not behaving accordingly.    
Added `++fortunecow`, `++randomcat`, `++rule34` and `++leetspeak`.   
Added `mashape_key` to `config.json`.   
Removed NSFW flags from commands that did not need them, as this will cause problems with `++help`.  
Removed `deletion.js`, as this is needlessly split.   

## 2.0.0-beta.2
Updated `versionchecker.js` to check for beta updates.   
Moved to double prefix activation instead of single prefix activation as requested by Discord API, we recommend using `++`.   
Bot is also compliant with the [Discord bot best practises](https://github.com/meew0/discord-bot-best-practices), also requested by Discord API.    

## 2.0.0-beta.1
Initial release of DougBot 2.0, featuring new permission system and stability improvements.
