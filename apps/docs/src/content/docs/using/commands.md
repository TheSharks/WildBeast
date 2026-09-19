---
title: Commands
description: The slash commands WildBeast provides and how to use them.
sidebar:
  order: 1
---

Use WildBeast through Discord slash commands. Type `/` in a channel the
bot can see and pick a command from the list. Command names and descriptions
are localized, so Discord shows them in your client's language when a
translation exists.

:::note
WildBeast 9 is under active development, and commands are still being
ported over from version 8. The reference lists the commands currently implemented.
Screenshots below were captured during v9 development and may lag the
current UI slightly; the text descriptions are authoritative.
:::

## General

### /ping

Checks whether the bot responds and reports its latency. The reply is
ephemeral, which means only you can see it.

```
/ping
```

The bot first answers "Pong!", then edits the reply with two numbers: how long
the round trip to Discord took, and the websocket latency of the shard serving
your server. Use these measurements as a starting point when investigating slow
replies.

![The bot replying to /ping with how long the reply took and the websocket latency](~/assets/screenshots/ping.png)

### /info

Shows what the bot is running: guild count, uptime, shard and cluster,
version, and resource usage. Only you can see the reply.

### /invite

Gives you a link to add the bot to your own server. If the bot is marked
private, it tells you who to ask instead. Only you can see the reply.

## Fun

### /8ball

Returns a random magic 8-ball answer to your question.

### /advice

A random piece of life advice, courtesy of adviceslip.com.

### /cat and /dog

A random cat or dog picture with an animal fact attached. The 🔄 button
under the image fetches a new one.

### /dice

Rolls the number of dice you choose, with a configurable number of sides.

```
/dice dice:2 sides:20
```

Both options are optional. By default, the command rolls one six-sided die.
You can roll up to 100 dice with up to 1,000 sides each.

### /inspire

Generates a motivational poster through inspirobot.me. Use the 🔄 button
to generate another.

### /booru

Searches imageboards, with tag autocompletion where the site supports it.

```
/booru e621 query:wolf
/booru rule34 query:...
/booru derpibooru query:pony
```

Use ◀️ and ▶️ to move through results, 🔀 for a random result, and ✖️
to dismiss the image. `rule34` (served by rule34.paheal.net) and
`derpibooru` only work in NSFW-marked channels and DMs. `e621` works
anywhere: in channels not marked NSFW it silently switches to e926, the
safe-rated mirror of the same site.

### /urbandictionary

Searches Urban Dictionary, with autocompletion while you type. Use the
◀️ ▶️ buttons to page through definitions and 🔀 to jump to a random one.
Definitions come from community submissions and may contain explicit language.

## Tags

Tags are named snippets of text anyone can save and recall. Each server
has its own tags, so the commands only work in servers, not DMs. Tag
content can use [TagScript](/tagscript/overview/), so a tag can greet
whoever runs it, do math, or pick a random reply.

### /tag show

Renders a tag and posts the result in the channel.

```
/tag show name:hello args:world
```

The optional `args` field passes space-separated arguments to the tag,
readable through the [argument tags](/tagscript/tags/). Mentions in tag
output never ping anyone.

![The bot rendering the hello tag as "Hi, dougley!"](~/assets/screenshots/tag-show.png)

### /tag create

Saves a new tag. Names are unique within the server, up to 32 characters.

```
/tag create name:hello content:Hi, {usertag}!
```

![The tag create command composed in the Discord message box with name and content filled in](~/assets/screenshots/tag-create-compose.png)

![The bot confirming it created the hello tag](~/assets/screenshots/tag-create.png)

A server can hold up to 50 tags; a premium subscription for the server
raises that to 500.

### /tag edit and /tag delete

Change or remove a tag. You must be its author or have the **Manage Server**
permission.

### /tag list

Lists tag names, up to 100 at a time. Pass a user to only show tags they
made. Promoted tags show as the slash command they answer to, like
`/hello`.

![The bot listing one tag, shown as the promoted command /hello](~/assets/screenshots/tag-list.png)

### /tag info

Shows who made a tag, how long its content is, and whether it has been
promoted to a command.

### /tag raw

Shows a tag's content exactly as stored, without rendering the TagScript
in it. The reply is ephemeral, handy for copying a tag you want to build
on.

### /tag promote and /tag demote

Promoting a tag turns it into a slash command of its own in your server:
instead of `/tag show name:hello`, members just run `/hello`.

```
/tag promote name:hello description:Greet someone
```

![The tag promote command composed in the Discord message box with name and description filled in](~/assets/screenshots/tag-promote-compose.png)

![The bot confirming the hello tag now answers to /hello in this server](~/assets/screenshots/tag-promote.png)

The description is optional and shows up in Discord's command picker.
Promoted commands keep the optional `args` field, so arguments work
exactly like they do with `/tag show`. `/tag demote` removes the command
again; the tag itself stays untouched.

![The Discord command picker showing /hello as a command of its own, with the description "Greet someone"](~/assets/screenshots/hello-picker.png)

Members now run the tag like any other command:

![The bot replying "Hi, dougley!" after a member used /hello](~/assets/screenshots/hello-run.png)

You need the **Manage Server** permission to promote or demote. Command
names follow Discord's rules: up to 32 characters, letters, numbers,
dashes, and underscores only, and they can't shadow one of the bot's own
commands. Tag names get lowercased on promotion; a name Discord won't
accept is rejected with the reason.

A server can promote 2 tags; a premium subscription for the server raises
that to 25. If the server's subscription lapses, existing commands keep
working, but the newest promotions over the cap are removed during nightly
maintenance once the bot has confirmed the change with Discord.

If Discord refuses to register the command (for example because the server
has reached Discord's own command limit), the reply tells you why. The bot
remembers the request and retries it during nightly maintenance, so the
command appears once the problem is resolved.

## Commands don't show up?

- The bot must be invited with the `applications.commands` scope. Reinviting
  with the invite link from the [FAQ](/using/faq/) fixes a missing scope.
- `/flags` is an operator command. It exists only in servers the bot's
  operators configured for it, and only they can run it.
- If you host WildBeast yourself and no commands appear, see
  [troubleshooting](/self-hosting/troubleshooting/#slash-commands-dont-appear).

## Next steps

- The [FAQ](/using/faq/) answers common questions about the bot itself.
- [TagScript](/tagscript/overview/) is the templating language behind
  WildBeast's dynamic responses; the [cookbook](/tagscript/cookbook/) has
  ready-made examples you can edit live.
