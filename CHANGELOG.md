# 7.0.0
## Release phase
### 7.1.0
Reintroduced translation support    
Introduce new music related commands: `fastforward`, `rewind`, `remove`    
Support sharding via environment variables    

### 7.0.0
**This is a breaking change**

Internal structure changed   
We no longer support ArangoDB as official database, the new official databases are SQLite and PostgreSQL  
Commands are no longer objects, instead they're based off classes     
Command indexing changed, commands can now be nested inside directories    
Event idexing changed, every event can now supply a directory to run multiple event handlers for one event    
Removed ffmpeg support for music streaming     
Removed Rancher scaling, this is replaced with Kubernetes scaling    
Removed Elasticsearch logging    

# 6.0.0
## Release phase
### 6.1.1
Stylistic changes    
Corrected documentation on decoupling to correctly expose both ports of Lavalink. Internal changes to reduce the quirks with this process    
Updated `docker-compose.yml` to allow updating of the WildBeast source code without decoupling
Added `restPort` property to Lavalink node configuration
Upgraded Lavalink to v3 and ArangoDB to 3.3.14

### 6.1.0
Removed translation submodule, we now include the standard file by default. Translations are able to be downloaded from our crowdin project     
CircleCI will now automatically include translations into new Docker images   
For Docker images, uws is locked to v10.148.1    
Commands that call external APIs will now indicate errors    
Music command have been updated to support lavalink v3   
Added optional embedded database powered by LokiJS   
Added new ffmpeg based voice encoder     
`++meme` will no longer use imgflip, memegen is used instead   
`++settings` will error out if an unknown language is being set    
Encoders and drivers are loaded on-demand instead of requiring them all   
Elasticsearch logging will now log command arguments instead of the full message    
Version checking will check for git commits instead of versions only, this falls back to original version check if git is not available    

### 6.0.0
**This is a breaking release, nothing is backwards compatible.**

Entire internal structure changed.   
We no longer officially support RethinkDB as a database, the official database is ArangoDB.   
Command indexing changed, each command lives in its own file now.   
Changed Discord library from Discordie to Eris (rip)   
All event handlers live in separate files instead of all being defined in the main script.   
**BREAKING CHANGE**: All configuration is now declared in the environment, `.env` files are supported. env vars are explained below:

| Variable | Required | Function |
|----------|----------|----------|
| `BOT_TOKEN` | **Mandatory** | The token to use |
| `BOT_PREFIX` | **Mandatory** | The prefix to use |
| `WILDBEAST_MASTERS` | **Mandatory** | String of user IDs separated by pipe characters that should be considered master users |
| `WILDBEAST_LANGUAGE` | Optional | Set default language to use |
| `WILDBEAST_SUPPRESS_COMMANDLOG` | Optional | If set, suppresses loglevel `CMD` |
| `WILDBEAST_PREFERRED_DATABASE` | Optional | Override the database driver used, defaults to `arangodb` |
| `WILDBEAST_PREFERRED_ENDCODER` | Optional | Override default encoder | 
| `WILDBEAST_VOICE_PERSIST` | Optional | Override default behaviour of leaving voice channels when playlists are done |
| `WILDBEAST_DISABLE_MUSIC` | Optional | If set, prevent any encoder from being loaded |
| `BEZERK_URI` | Optional | URI of Bezerk server |
| `BEZERK_PASSWORD` | Optional | Password for Bezerk server |
| `ELASTICSEARCH_URI` | Optional | If set, configure logging to log to Elasticsearch |
| `ELASTICSEARCH_INDEX` | Optional | Override default index of `wildbeast` for Elasticsearch logging |
| `SENTRY_DSN` | Optional | If set, configure error logging to report to Sentry as well |
| `ARANGO_URI` | Optional | If set, override the default Arango URI of `http://localhost:8529` |
| `ARANGO_USERNAME` | Required if running default | Set the username used for authenticating with Arango |
| `ARANGO_PASSWORD` | Required if running default | Set the password used for authenticating with Arango |
| `ARANGO_DATABASE` | Optional | If set, override the default database used, defaults to `wildbeast` |
| `NODE_ENV` | Optional | If set to `debug`, enable verbose logging |
| `IMGFLIP_USERNAME` | Optional | Set username to use with Imgflip | 
| `IMGFLIP_PASSWORD` | Optional | Set Imgflip password |
| `IMGUR_KEY` | Optional | Set Imgur key |
| `TWITCH_ID` | Optional | Set Twitch client ID |
| `LAVA_NODES` | Required | JSON string containing Lavalink node information |
| `RANCHER_AUTOSCALE` | Optional | If set, enable additional features exclusive to Rancher orchestrated environments |
 
# 5.0.0
Skipped, this was developed internally but never released or finished.

# 4.0.0
## Release phase

### 4.5.0
Improvements to command handler.    
Improvement to permissions database controller.    
Improvement to customize database controller.
Improvement to join-voice command.    
Improvement to songs playing.

### 4.4.0
Improvements to help handler.    
Added aliases to `dogfact` and `catfact`.    
Changed API of `catfact` to a working version.    
Change urbandictionary format to embed style.    

### 4.3.0
Added Contributor Covenant Code of Conduct as per GitHub's new standards.    
Reworked Docker container: Changed the way the database creation works (Migrated from Dockerfile to entrypoint.sh).    
Dropped user account support and Mashape integration.    
The bot now uses the `dev` version of `discordie`.    
Removed `request` and `unirest` in favor of `superagent`.    
Added `hackban`, `softban`, `randomdog`, `dogfact`, `shorten` commands.    
Updated `kick` and `ban` commands to allow for reason submitting to audit logs.    
Lots of other miscellaneous bug fixes, backend changes and under-the-hood improvements.    

### 4.2.2
Improvements to errors and other debug information.  
Added 3 new role related commands: `addrole`, `takerole` and `colorrole`. Refer to http://docs.thesharks.xyz/commands for more information.  
Added dogfact command.  
Handle attempts to delete messages older than 2 weeks due to changes to the message delete API endpoint.  
And as per usual, miscellaneous bug fixes and issue resolves.  

### 4.2.1
Reworked sestatus command, particular improvements:   
- Allow for more status options to be passed. (Online, idle, DND, invisible)   
- Allow status to be cleared if no suffix is passed.   
- Misc improvements and added PEBKAC repellant.   
   
More verbose logging for the request command to improve capability to debug voice errors.   
Other miscellaneous fixes.   

### 4.2.0
Added Elasticsearch as an option to store logs to, file based logging is semi-deprecated because of this.   
Added [Bezerk](https://github.com/TheSharks/Bezerk) support.   
Added Imgur key, required for the new `randommeme` command.   
Added global ignoring.    
Added the ability to customize initial volume when joining voice.   
Playlist can be cleared with `++playlist clear`   
Specific songs can be removed from the playlist with `++playlist remove <number>`   
Tags from users can be listed with `++tag list @User`   
Random tags can be showed with `++tag random`   
Botapi variable for node-cleverbot has been set.   

### 4.1.0
Added Dockerfiles = Docker support. Documentation for Docker installation added.   
Added a npm script to create database tables, `npm run-script dbcreate`. Removes `--createdatabase` being required at intial run.    
Informational commands like `info` use Discord embeds now.   
Added xkcd comic search command back.    
Songs can now be deleted from the playlist. (`++playlist delete <position>`)   
Bugsnag is added as a dependency for reporting errors, **bugsnag is not required to run WildBeast.**    
Added rankup command which allows increase of user level by one.    
Database now tracks guild owner changes so level 4 permissions are transferred automatically.    
Remove obsolete features (CSE, chat logger etc.) that are remnants from pre-2.0 or similar.    

### 4.0.0
**This update is a breaking change, back up your configs before updating!**     
Retired nedb for datastorage, now using RethinkDB. Setup process now requires setup of local RDB server, documentation updated to reflect.     
Tags now use TagScript which allows for a more flexible tag system.     
YouTubeDL now tries to get only audio to lower your bandwidth usage.     
Waiting music now shuffles between two songs.     
Tons of miscellaneous bug fixes.     
*When updating to this version, make sure you have read the updated documentation to get it running again.*

# 3.0.0
## Release phase
### 3.2.0
Internal tweaks.   
Retired XL formatting in help for INI formatting.   
WildBeast now alerts the user with a more descriptive error message if the config file is invalid or missing.   
The special word `%user` now resolves to a mention instead of the username.   
`INVALID` doesn't get dumped to the playlist anymore if YouTube videos from a YT playlist fail to fetch, they'll get silently dropped instead.   
`leave` is renamed to `leave-server` to avoid confusion.    

### 3.1.1
Fixed welcome message not sending properly when set to private.   

### 3.1.0
Welcome messages can now be send via private messages.   

### 3.0.0
Masters are now at `Infinity` instead of 9.   
Voice channel join messages now use a customized prefix if available.    

## Beta phase
### 3.0.0-beta.6
Introduced `shuffle` and `voteskip` as music commands.    
Introduced `master` as a new access level.    
Several small tweaks and improvements.    
 
### 3.0.0-beta.5
Several improvements.    

### 3.0.0-beta.4
Added the ability to set roles to access levels.

### 3.0.0-beta.3
Improved performance from YouTube playlist fetching.     
Added `shardmode`    

### 3.0.0-beta.2
Fixed initial setup misbehaving if user was sure about using a normal Discord account.    
Enabled versionchecker.   
Fixed `voice` not working properly if user was not connected to any voice channel.    
Fixed some internal quirks.    

### 3.0.0-beta.1
Introduced tags.   

## Alpha phase
### 3.0.0-alpha.2
Enabled command alias system.   
Changed giphy endpoint for more randomness.   
Added a `noDM` key.   

### 3.0.0-alpha.1
Initial release, featuring all-new code.

# 2.0.0
## Release phase
### 2.1.1
Added timeouts.    
Changed `request` to only accept full links from now on.    
Made preparations for a future update.     

### 2.1.0
Changed callbacks to promises.     
Removed `playliststart`, playlists start automatically after the first video has been entered.     
Extended timeout for initial join.     
Several small tweaks.     

### 2.0.0
Revamped database system.
Added token login support for the upcoming official Discord API.         
Added expansive server-specific customization options.     
Added user tracking for namechanges.      
Added an upgrade script for users to upgrade from gamma.7 to 2.0.0     
Removed server defaulting system.     
Removed unneeded and unfinished files in `runtime`.      
Removed unnecessary fluff from `config.json`.      
Removed `welcoming-whitellist.json`, this is now handled by `customize`.     
Removed `birds`, `ìdle` and `online`, `idle` and `online` are replaced with `setstatus`.     
Temporary removed server blacklisting system, this will be reintroduced later.      

## Gamma phase
(Gamma is a real thing in software development by the way, it's a synonym for RC (Release Candidate))
### 2.0.0-gamma.7
Changed welcoming system to adhere to a whitelist instead of being global.    
Added server blacklisting for `join-server`.    
**IMPORTANT** Changed `join-server` to use mentions instead of usernames, the new invocation is `join-server @WildBeast <instant-invite>`, change `WildBeast` with your bots username.

### 2.0.0-gamma.6
Added YouTube playlist support.    

### 2.0.0-gamma.5
Removed `play` and `yt-play`.    
Added playlisting for YouTube video's.    

### 2.0.0-gamma.4
Revamped music streaming permissions due to the way the normal permissions handle.    
Added some extra commands.    
Hopefully improved the reliability of `stop` for music streaming.   
Made preparations for a future update.    

### 2.0.0-gamma.3
*This is a relative small update.*   
Added YouTube streaming.   

### 2.0.0-gamma.2
Added some extra commands.   
Revamped debug mode and verbose logging.   
Changed `setowner` to set server owner to level 4 instead of level 3.  
Changed commands that where at level 4 to level 5.    

### 2.0.0-gamma.1
Added a timeout feature.    
**GET HYPED FOR MUSIC STREAMING!**      
Changed `versionchecker.js` ability to check for beta versions to gamma version checking.    
Moved to LevelDB instead of Redis for handling permission storage and handling timeouts.      

## Beta phase
### 2.0.0-beta.5
Fixes several problems caused by 2.0.0-beta.4   
Added an *incomplete* server defaulting system.   
Added `setstatus`.     
Changed the fixed length of `cmd_prefix` to a dynamic length.   
Changed the fixed character prefix to switch to mention activation if desired.   

### 2.0.0-beta.4
Fixed `myapifilms_token` not existing.  
Fixed problems with `++setowner`.  
Added `debug_mode` and `verbose_logging`. *(Note, only enable these on request of the devs!)*   
Added a config value that'll change the way `++help` functions.  
Updated the layout of `config.json`, **meaning that users need to remake their config files.**

### 2.0.0-beta.3
Fixed `giphy.js` not having requires.  
Fixed `suffix` not behaving accordingly.    
Added `++fortunecow`, `++randomcat`, `++rule34` and `++leetspeak`.   
Added `mashape_key` to `config.json`.   
Removed NSFW flags from commands that did not need them, as this will cause problems with `++help`.  
Removed `deletion.js`, as this is needlessly split.   

### 2.0.0-beta.2
Updated `versionchecker.js` to check for beta updates.   
Moved to double prefix activation instead of single prefix activation as requested by Discord API, we recommend using `++`.   
Bot is also compliant with the [Discord bot best practises](https://github.com/meew0/discord-bot-best-practices), also requested by Discord API.    

### 2.0.0-beta.1
Initial release of DougBot 2.0, featuring new permission system and stability improvements.

## Alpha phase
Nothing too interesting lol.
