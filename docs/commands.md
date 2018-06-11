title: Command reference
description: WildBeast command reference
path: tree/master/docs
source: commands.md

This is the command reference for WildBeast. You can find more elaborative information here on each of the commands currently implemented.

!!! tip
    Send the message **++help <command\>** (Prefix may vary) to the bot to get further information on any given command.

Some commands on this page will have an empty **Usage** field. This means that the command takes no arguments and is accepted as such.

Parameters marked with **<placeholders\>** are supposed to be replaced by other values. Do not incude the actual braces in the command. Similarly, **@user** placeholders refer to mentions. Parameters surrounded by [brackets] signify parameters that may be omitted.

## Commands

### Admin

| Name | Description | Usage | Level/Required permission |
| ---- | ----------- | ----- | ------------------------- |
| addrole | Give a role to user or users. | addrole @user @user2 **<role name\>** | Manage Roles |
| takerole | Take a role from a user. | takerole @user @user2 **<role name\>** | Manage Roles |
| colorrole | Change the color of a role. | colorrole **<role name\>** **<hex value\>**[^1] | Manage Roles |
| kick | Kick a user. | kick @user **[reason]** | Kick Members |
| ban | Ban a user. | ban @user **[reason]** | Ban Members |
| softban | Softban[^2] a user. | softban @user **[reason]** | Ban Members |
| hackban | Ban a user by ID. | hackban **<userid\>** **[reason]** | Ban Members |
| purge | Delete multiple messages at once. | purge **[author]** @user **<number\>**  | Manage Messages |
| leaveserver | Make the bot leave the current server. |  | 10 |

### Fun

| Name | Description | Usage | Level/Required permission |
| ---- | ----------- | ----- | ------------------------- |
| advice | Get some clever advice. |  | 0 |
| catfact | Get a cat fact. |  | 0 |
| dice | Roll the dice. |  | 0 |
| dogfact | Get a dog fact. |  | 0 |
| fact | Get a random fact. |  | 0 |
| fancyinsult | Insult someone in a fancy manner. |  | 0 |
| gif | Search Giphy for a gif. | gif **<query\>** | 0 |
| leetspeak | Encode a message into l337sp3@K. | leetspeak **<message to encode\>** | 0 |
| magic8ball | Ask the magic 8-ball for advice. | magic8ball **<question\>** | 0 |
| meme | Create a meme. | meme **<meme type\>** "upper text" "lower text"[^3] | 0 |
| randomcat | Get a random cat picture. |  | 0 |
| randomdog | Get a random dog picture. |  | 0 |
| randomcat | Get a random meme from Imgur. |  | 0 |
| stroke | Stroke someone's ego. | stroke **<name\>** | 0 |
| twitch | Check if a streamer is live on Twitch. | twitch **<username\>** | 0 |
| urbandictionary | Get the definition of a word from the Urban Dictionary. | urbandictionary **<word\>** | 0 |
| xkcd | Get a random XKCD comic, or supply a number to get that particular comic. | xkcd **<comic number\>** | 0 |
| yesno | Get a GIF saying yes or no. |  | 0 |
| yomomma | Get a random yo momma joke. |  | 0 |

### Music

| Name | Description | Usage | Level/Required permission |
| ---- | ----------- | ----- | ------------------------- |
| join-voice | Make the bot join a voice channel. | join-voice **<channel name\>** | 1 |
| leave-voice | Make the boit leave the current voice channel. |  | 1 |
| nowplaying | Show the currently playing track. |  | 1 |
| queue | Show the playback queue. |  | 1 |
| shuffle | Shuffle the playback queue. |  | 1 |
| skip | Skip the current song. |  | 1 |
| volume | Change the playback volume. | volume **<0-100\>** | 1 |

### NSFW

!!! warning "NSFW content"
    These commands are labeled as not safe for work and can only be used within a channel that is marked as NSFW via the channel settings.

| Name | Description | Usage | Level/Required permission |
| ---- | ----------- | ----- | ------------------------- |
| booru | Query various booru sites for images. | booru **<gelbooru/rule34/e621\>** **<search query\>** | 0 |
| e621 | Query e621 for an image. | e621 **<search query\>** | 0 |
| rule34 | Query rule34 for an image. | rule34 **<search query\>** | 0 |

### Tags

!!! tip
    You can use JagTag formatting with the **tag create** command. See [the JagTag-JS documentation](https://thesharks.github.io/JagTag-JS/users/intro) for more information on how.

| Name | Description | Usage | Level/Required permission |
| ---- | ----------- | ----- | ------------------------- |
| tag | Base command for tags. Returns a tag if specified. | tag **<subcommand/name\>** | 0 (Applies to all subcommands) |
| tag create | Create a tag. | tag create **<name\>** **<content\>** |
| tag delete | Delete a tag. | tag delete **<name\>** |
| tag edit | Edit an existing tag. | tag edit **<name\>** **<newcontent\>** |
| tag owner | Return the owner of a tag. | tag owner **<name\>** |
| tag random | Retrieve a random tag from the database. | tag random |
| tag raw | Return the raw data of a tag. | tag raw **<name\>** |

### Settings

| Name | Description | Usage | Level/Required permission |
| ---- | ----------- | ----- | ------------------------- |
| settings | Base command for settings. Returns current settings if no setting is specified. | settings **<setting\>** **<parameter\>** | 5 |
| setlevel | Change someone's permission level. | setlevel @user/@role @user2/@role2 **<0-10\>** | 7 |
 
The following settings can be customised. All settings are server-specific.

**Note:** Languages are still WIP. Only the "en" language is supported at the moment.

| Name | Description | Usage |
| ---- | ----------- | ----- |
| prefix | Change the command prefix. | settings prefix **<newprefix\>** |
| language | Change the language the bot will respond in. | settings language **<language\>** |
| welcome | Change the welcome message target. | settings welcome **<#channel/dm\>** |
| welcomeMessage | Change the welcome message that is sent when a new member joins. | settings welcomeMessage **<message\>** |
| reset | Reset a setting to its default value. | settings reset **<setting\>** |

### Utility

| Name | Description | Usage | Level/Required permission |
| ---- | ----------- | ----- | ------------------------- |
| info | Return information about the bot. |  | 0 |
| ping | Return the bot's pseudo-ping. |  | 0 |
| say | Make the bot send a message of your choice. | say **<message\>** | 0 |
| userinfo | Return information about a user ID, mention or name. Omit parameters to return information about yourself. | userinfo **<userid/mention/username\>** | 0 |

### Available meme types

The values in the **Name** column of the table below correspond to the relevant meme ID on https://api.imgflip.com/popular_meme_ids.

| Name | ID |
| ---- | -- |
| brace | 61546 |
| mostinteresting | 61532 |
| fry | 61520 |
| onedoesnot | 61579 |
| yuno | 61527 |
| success | 61544
| allthethings | 61533 |
| doge | 8072285 |
| drevil | 40945639 |
| skeptical | 101711 |
| notime | 442575 |
| yodawg | 101716 |
| ermahgerd | 101462 |
| hipsterariel | 86601 |
| imagination | 163573 |
| grumpycat | 405658 |
| morpheus | 100947 |
| 1stworldproblems | 61539 |
| facepalm | 1509839 |
| wtf | 245898 |
| batmanslaprobin | 438680 |
| takemymoney | 176908 |
| gollum | 681831 |
| grindmygears | 356615 |
| consuela | 160583 |
| ineedyouto | 89655 |
| chucknorrisapproves | 241304 |
| asianfather | 61559 |
| foreveralone | 61528 |
| grandmainternet | 61556 |
| zoidberg | 61573 |
| troll | 101484 |
| familyguybrian | 674967 |
| obama | 185239 |
| badluckbrian | 61585 |
| philosoraptor | 61516 |
| 3rdworldsuccess | 101287 |
| ancientaliens | 101470 |

[^1]: A hexadecimal value can be submitted in either **#FFFFFF** or **FFFFFF** format.
[^2]: Softbanning includes banning a user and immediately unbanning them, removing their messages without barring their access in future.
[^3]: Including the quotes in the text values is important.
