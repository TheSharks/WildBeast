---
title: Commands
description: The slash commands WildBeast provides and how to use them.
sidebar:
  order: 1
---

WildBeast speaks through Discord slash commands: type `/` in a channel the
bot can see and pick a command from the list. Command names and descriptions
are localized, so Discord shows them in your client's language when a
translation exists.

:::note
WildBeast 9 is under active development, and commands are still being
ported over from version 8. This page grows with each release.
:::

## General

### /ping

Checks that the bot is alive and how fast it responds. The reply is
ephemeral, only you can see it.

```
/ping
```

The bot first answers "Pong!", then edits the reply with two numbers: how
long the round trip to Discord took, and the websocket latency of the shard
serving your server. Useful when the bot feels slow and you want to tell
whether the delay is on Discord's side.

### /info

Shows what the bot is running: guild count, uptime, shard and cluster,
version, and resource usage. Ephemeral.

### /invite

Gives you a link to add the bot to your own server. If the bot is marked
private, it tells you who to ask instead. Ephemeral.

## Fun

### /8ball

Ask the magic 8-ball for advice. All the classic answers are in there.

### /advice

A random piece of life advice, courtesy of adviceslip.com.

### /cat and /dog

A random cat or dog picture with an animal fact attached. The 🔄 button
under the image fetches a new one.

### /dice

Roll some dice.

```
/dice dice:2 sides:20
```

Both options are optional; the default roll is 1d6. Up to 100 dice with up
to 1,000 sides each.

### /inspire

A freshly generated motivational poster from inspirobot.me. Results may
inspire confusion instead. The 🔄 button generates another.

### /booru

Searches imageboards, with tag autocompletion where the site supports it.

```
/booru e621 query:wolf
/booru rule34 query:...
/booru derpibooru query:pony
```

Results page with the same ◀️ ▶️ 🔀 buttons as Urban Dictionary, plus ✖️
to dismiss the image. `rule34` (served by rule34.paheal.net) and
`derpibooru` only work in NSFW-marked channels and DMs. `e621` works
anywhere: in channels not marked NSFW it silently switches to e926, the
safe-rated mirror of the same site.

### /urbandictionary

Searches Urban Dictionary, with autocompletion while you type. Use the
◀️ ▶️ buttons to page through definitions and 🔀 to jump to a random one.
Definitions are community-written and frequently crude; that's the site,
not the bot.

## Tags

Tags are named snippets of text anyone can save and recall. Their content
can use [TagScript](/tagscript/overview/), so a tag can greet whoever runs
it, do math, or pick a random reply.

### /tag show

Renders a tag and posts the result in the channel.

```
/tag show name:hello args:world
```

The optional `args` field passes space-separated arguments to the tag,
readable through the [argument tags](/tagscript/tags/). Mentions in tag
output never ping anyone.

### /tag create

Saves a new tag. Names are unique across the bot, up to 32 characters.

```
/tag create name:hello content:Hi, {username}!
```

### /tag edit and /tag delete

Change or remove a tag. Only the person who created a tag can edit or
delete it.

### /tag list

Lists tag names, up to 100 at a time. Pass a user to only show tags they
made.

### /tag info

Shows who made a tag and how long its content is.

### /tag raw

Shows a tag's content exactly as stored, without rendering the TagScript
in it. The reply is ephemeral, handy for copying a tag you want to build
on.

## Commands don't show up?

- The bot must be invited with the `applications.commands` scope. Reinviting
  with the invite link from the [FAQ](/using/faq/) fixes a missing scope.
- If you host WildBeast yourself and no commands appear, see
  [troubleshooting](/guides/troubleshooting/#slash-commands-dont-appear).

## Next steps

- The [FAQ](/using/faq/) answers common questions about the bot itself.
- [TagScript](/tagscript/overview/) is the templating language behind
  WildBeast's dynamic responses; the [cookbook](/tagscript/cookbook/) has
  ready-made examples you can edit live.
