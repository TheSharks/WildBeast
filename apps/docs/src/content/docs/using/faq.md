---
title: FAQ
description: Common questions about WildBeast and WildBot.
sidebar:
  order: 2
---

Find answers about hosting, commands, and contributing. You can ask other
questions in the [Discord server](https://discord.gg/wildbot).

## Do I need to host WildBeast myself?

No. The Sharks run a public instance called WildBot that you can invite
to your server at [invite.thesharks.xyz](https://invite.thesharks.xyz). It
runs this same open-source codebase.

Hosting your own instance gives you full control over configuration and
scale; the [getting started guide](/self-hosting/getting-started/) walks through
it.

## What's the difference between WildBeast and WildBot?

WildBeast is the open-source framework, the code in the
[GitHub repository](https://github.com/TheSharks/WildBeast). WildBot is the
public bot The Sharks host with it. Documentation about commands and
TagScript applies to both; the Self-hosting section applies to people
running their own instance.

## Which commands does the bot have?

See the [command reference](/using/commands/). Version 9 is a rewrite in
progress, so the set is small right now and grows with each release. If you're
hosting a v8 instance, [Upgrading from v8](/self-hosting/upgrading-from-v8/)
explains what changed.

## What is TagScript?

TagScript is a small templating language for writing messages that change based
on context: who ran the command, which server it ran in, arguments, time, and
math. Start with the [overview](/tagscript/overview/), which includes a live
playground, or grab a ready-made template from the
[cookbook](/tagscript/cookbook/).

## Can I help translate the bot?

Yes. Translations are managed on
[Crowdin](https://crowdin.com/project/wildbeast); join the project and
translate the strings for your language. New source strings are always
written in English (`en-US`).

Translations can ship before a language is complete. If a string is missing
in your language, the bot uses the `en-US` version. The bot prefers your own
client locale over the server locale when picking a language.

This documentation is translated in the same Crowdin project. A language
shows up in the site's language picker once its first page is fully
translated. Pages that aren't translated yet appear in English with a
notice.

## Where do I report bugs or request features?

Open an issue on [GitHub](https://github.com/TheSharks/WildBeast/issues). For
quick questions, the [Discord server](https://discord.gg/wildbot) works too. If
you want to contribute code, read the
[contributing guidelines](https://github.com/TheSharks/WildBeast/blob/master/.github/CONTRIBUTING.md)
and the [Development](/development/architecture/) section.

## Is WildBeast free?

The code is open source; see
[LICENSE.md](https://github.com/TheSharks/WildBeast/blob/master/LICENSE.md)
in the repository for the exact terms. WildBot is free to invite and use.
