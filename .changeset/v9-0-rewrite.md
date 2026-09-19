---
'@thesharks/discord': major
---

WildBeast 9 is a ground-up rewrite in TypeScript on [Sapphire](https://www.sapphirejs.dev/) and discord.js, replacing `detritus-client`. It isn't a drop-in upgrade: treat it as a fresh installation and follow [Upgrading from v8](https://wildbeast.guide/self-hosting/upgrading-from-v8/).

- Node.js 22 or later and pnpm are required.
- Redis is now required, even for a single cluster. It backs scheduled tasks, identify rate limiting, and persisted gateway sessions. PostgreSQL is still required.
- `DISCORD_TOKEN` replaces `BOT_TOKEN`, which still works as a legacy alias. Most other settings are new; see the [configuration reference](https://wildbeast.guide/self-hosting/configuration/).
- Tags are per server. v8 tags were global, and there's no automatic data migration, so recreate the tags you still need.
- Guild counts are no longer posted to bot-listing sites. The v8 listing tokens (`TOP_GG_TOKEN`, `BOTS_GG_TOKEN`, and the others) are ignored.
- Not carried over from v8: `/meme`, the Gelbooru source for `/booru`, and the avatar context menu action.
