title: Command reference
description: WildBeast command reference
path: tree/master/docs
source: commands.md

This is the command reference for WildBeast. You can find more elaborative information here on each of the commands currently implemented.

!!! tip
    Send the message **++help <command\>** (Prefix may vary) to the bot to get further information on any given command.

## Gotchas

1. Some commands on this page will have an empty **Usage** field. This means that the command takes no arguments and is accepted as such.

2. Parameters marked with **<placeholders\>** are supposed to be replaced by other values. Do not incude the actual braces in the command. Similarly, **@user** placeholders refer to mentions. Parameters surrounded by **[brackets]** signify parameters that may be omitted.

3. Commands in the **NSFW** category have been labeled as not safe for work and can only be used in a channel that has been marked as NSFW in the channel settings.

Additional command information:

[Addendums](#addendums)<br>
[Tag subcommands](#tag-subcommands)<br>
[Settings subcommands](#settings-subcommands)<br>
[Available meme types](#available-meme-types)

## Commands

<div id="commands-table"></div>

## Addendums

1. For the **colorrole** command, a hexadecimal value can be submitted in either **#FFFFFF** or **FFFFFF** format.
2. The **softban** command bans a user and then immediately unbans them, deleting their messages without barring future access to the server.
3. The **request** command supports playing from the following resources: YouTube, SoundCloud, Bandcamp, Twitch, Vimeo, Mixer and raw HTML audio.

## Tag subcommands

The tag command has the following subcommands. All subcommands inherit the permission level of the main command.

!!! tip
    You can use JagTag formatting with the **tag create** command. See [the JagTag-JS documentation](https://thesharks.github.io/JagTag-JS/users/intro) for more information on how.

| Name | Description | Usage |
| ---- | ----------- | ----- |
| tag create | Create a tag. | tag create **<name\>** **<content\>** |
| tag delete | Delete a tag. | tag delete **<name\>** |
| tag edit | Edit an existing tag. | tag edit **<name\>** **<newcontent\>** |
| tag owner | Return the owner of a tag. | tag owner **<name\>** |
| tag random | Retrieve a random tag from the database. | tag random |
| tag raw | Return the raw data of a tag. | tag raw **<name\>** |

## Settings subcommands

The following settings can be edited with this command. All settings are server-specific and all subcommands inherit the permission level of the main command.

!!! note
    Translation support is in beta, please see the [translation repository](https://github.com/TheSharks/WildBeast/WildBeast-Translations) for supported languages.

| Name | Description | Usage |
| ---- | ----------- | ----- |
| prefix | Change the command prefix. | settings prefix **<newprefix\>** |
| language | Change the language the bot will respond in. | settings language **<language\>** |
| welcome | Change the welcome message target. | settings welcome **<#channel/dm\>** |
| welcomeMessage | Change the welcome message that is sent when a new member joins. | settings welcomeMessage **<message\>** |
| reset | Reset a setting to its default value. | settings reset **<setting\>** |

## Available meme types

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
