title: Migration information
description: Information on migrating WildBeast instances from v4 to v6
path: tree/master/docs
source: migrating.md

This document outlines the migration procedure from WildBeast version 4 and prior to WildBeast version 6.

## Introduction

WildBeast version 6 has been in development for nearly a year at the time of writing and has now released. While on the user end very little has changed, the newest release has received a complete overhaul under the hood.

## Main changes

- WildBeast now uses ArangoDB for data storage instead of RethinkDB.
- Command indexing has been changed. Commands are stored in individual files, as opposed to categorical sorting.
- WildBeast has moved to Eris as Discord library, instead of using Discordie.
- Configuration has been moved away from static files into environment variables using [dotenv](https://npmjs.com/package/dotenv).
- The installation procedure has received a major shift. Installation is now performed using Docker instead of manually installing dependencies.
- WildBeast now uses [JagTag-JS](https://github.com/TheSharks/JagTag-JS) for tag scripting, as opposed to [TagScript](https://github.com/devsnek/TagScript).
- Audio is now encoded with [Lavalink](https://www.npmjs.com/package/eris-lavalink) instead of FFMPEG.

## Notice to selfhosters

In practice, this means that:

- Data stored by WildBeast <= v4 instances **is not** compatible with v6.
- Commands written for <= v4 instances **are not** compatible with v6.
- Configuration for <= v4 instances **is not** compatible with v6.
- The dependencies installed by <= v4 instances **are largely extraneous**.

As you can probably infer from this, v6 is a breaking change of the highest caliber. If you wish to retain any data you have in your current instance, **DO NOT UPDATE.** V4 will no longer receive support, but you may still continue running it if you wish to retain your data.

If you do not have data you care for in your instance, here is what improvements you can expect from v6 as opposed to v4.

- **Streamlined installation procedure**: Installaton via Docker makes the installation quick and virtually effortless.
- **Reduced disk footprint**: Due to WB using proprietary JagTag-JS technology for tag scripting, Python 2.7 and C++ build tools are no longer required.
- **Better sound quality and music performance**: Lavalink is now used for encoding, which results in better sound quality with a fraction of the memory footprint of FFMPEG.

## TL;DR

WildBeast v4 is in no way compatible with v6. If you wish to retain your data, do not update. Otherwise you may follow the installation procedure for Windows or Linux from the menu on the left.
