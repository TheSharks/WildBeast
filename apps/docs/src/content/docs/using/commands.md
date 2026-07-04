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
WildBeast 9 is under active development, and its command set is still small
while features are ported over from version 8. This page grows with each
release.
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
