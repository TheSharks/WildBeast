---
'@thesharks/discord': minor
---

Rebuilt tags on the new [TagScript](https://wildbeast.guide/tagscript/overview/) engine, so a tag can take arguments, do math, or pick a random reply.

- Added `/tag list`, `/tag info`, and `/tag raw` alongside `/tag show`, `/tag create`, `/tag edit`, and `/tag delete`.
- Added `/tag promote` and `/tag demote`, which turn a tag into a slash command of its own in your server, so members run `/hello` instead of `/tag show name:hello`.
- Tag names are case-insensitive and autocomplete with fuzzy search.
