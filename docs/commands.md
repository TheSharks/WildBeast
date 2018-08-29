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

## Commands

<div id="commands-table"></div>

## Addendums

1. For the **colorrole** command, a hexadecimal value can be submitted in either **#FFFFFF** or **FFFFFF** format.
2. You can get all the available meme types for the **meme** command by using the command **meme templates**.
3. The **softban** command bans a user and then immediately unbans them, deleting their messages without barring future access to the server.
4. The **request** command supports playing from the following resources: YouTube, SoundCloud, Bandcamp, Twitch, Vimeo, Mixer and raw HTML audio.

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
    Translation support is in beta, please see the [translation directory](https://github.com/TheSharks/WildBeast/tree/master/src/languages) for supported languages.

| Name | Description | Usage |
| ---- | ----------- | ----- |
| prefix | Change the command prefix. | settings prefix **<newprefix\>** |
| language | Change the language the bot will respond in. | settings language **<language\>** |
| welcome | Change the welcome message target. | settings welcome **<#channel/dm\>** |
| welcomeMessage | Change the welcome message that is sent when a new member joins. | settings welcomeMessage **<message\>** |
| reset | Reset a setting to its default value. | settings reset **<setting\>** |
