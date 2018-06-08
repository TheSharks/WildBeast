title: Legacy custom commands
description: WildBeast custom command reference (Legacy)
path: tree/master/docs
source: legacy_custom_commands.md

This document outlines the procedure for writing custom commands for WildBeast versions previous to version 6.

!!! failure "Legacy content ahead"
    This guide is no longer being updated after the release of WildBeast v6. It is highly recommended to migrate to v6 if possible as v4 is no longer supported.

!!! warning "Custom command support"
    Some basic JavaScript knowledge is required to write custom commands. Support for doing this will not be provided in addition to what is listed on this page, if the issue does not specifically concern WildBeast.
    

## Intro

Starting at version 3.0.0, WildBeast allows for the addition of user created JavaScript files with commands, given that they are written in the exact same format as default files. This page provides you with the tools you need to create your own commands.

## Important notes

1. Files need to declare commands to an array, and the array needs to be exported as `Commands`.
    - In practice: `#!js var Commands = []` and `#!js exports.Commands = Commands`
2. Your command files must be in the `custom` folder within the `commands` folder. The path would therefore be `~/WildBeast/runtime/commands/custom`.
3. Commands are **objects** added to an **array**.
4. Aliases can't be shared between commands. This means that a custom command can't have the same alias as a default command. The bot will stop itself from running and spit out an error if this happens, for safety reasons.
5. Any functions that use for instance config fields and so forth need to be imported in the format `../../file.ext` or `../file.ext` depending on what folder the file is in.

## Property declaration

Command objects consist of different properties which define how the command runs. There are mandatory properties and optional properties, divided into their own lists. The command callback name is decided by the `<cmdname>` placeholder in `Commands.<cmdname>`.

### Property scheme

**Mandatory properties**

| Property | Type | Description |
| -------- | ---- | ----------- |
| name | [String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) | Command name for the help module, **not** callback name! See above. |
| help | [String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) | Message displayed when `help <command>` is called on the command. |
| level | [String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) / [Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number) | Minimum user access level (0-3 int) required to execute this command. Set to `'master'` to restrict usage to config-defined master users. |
| fn | [Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function) | Defines the JavaScript function to execute when the command is called. |

**Optional properties**

| Property | Type | Description |
| -------- | ---- | ----------- |
| noDM | [Boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean) | Whether to allow usage in direct messages. Default true. |
| timeout | [Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number) | Unsigned integer that defines how long a command will be on timeout before it's usable again. The number represents seconds. |
| usage | [String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) | The example of how the command is used when `help <command>` is called on the command. |
| overwrite | [Boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean) | Whether to accept this command instead of the default one, in case the callback name is the same. Default false. |
| aliases | [Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)> | Hardcoded aliases to call this command with in addition to the default callback name. |
| hidden | [Boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean) | Whether to hide the command from the command list returned with `help`. Default false. |

## Example structure

Simple command example:

```js
const Commands = [] // Declaration of the command array

Commands.ping = {
  name: 'ping',
  help: 'Check if I still live.'
  timeout: 10,
  overwrite: true, // WildBeast already has a command called ping, will overwrite with this
  aliases: ['pong'],
  level: 0,
  fn: function(msg) {
    msg.channel.sendMessage('I LIVE')
  }
}

exports.Commands = Commands // Expose the commands to the commandcontrol module
```

Example of command that uses an external module:

```js
const Commands = [] // Declaration of the command array
const config = require('../../../config.json') // Import config

Commands.prefix = {
  name: 'prefix',
  help: 'Ask the bot what the configured prefix is.'
  timeout: 30,
  overwrite: true,
  level: 'master',
  fn: function(msg) {
  	msg.channel.sendMessage('My prefix is ' + config.prefix)
  }
}

exports.Commands = Commands // Expose the commands to the commandcontrol module
```

And that's how easy it is to create your own commands for WildBeast. Good luck in making your commands, and tinker to your heart's desire!
