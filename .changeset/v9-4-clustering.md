---
'@thesharks/discord': minor
---

Reworked [clustering](https://wildbeast.guide/self-hosting/clustering/). Each shard runs in a worker thread, and clusters coordinate identifies and shard ranges through Redis. In autonomous mode, clusters rebalance shards between themselves, size new fleets automatically, resume gateway sessions across shard handoffs, and move to a new shard total through a [rolling deploy](https://wildbeast.guide/self-hosting/resharding/).
