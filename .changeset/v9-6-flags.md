---
'@thesharks/discord': minor
---

Added [runtime flags](https://wildbeast.guide/development/features/) through OpenFeature. An optional OFREP service can disable a command or task, change a limit, or assign an experiment variant without a deploy. Without one, every flag uses its in-code default. The owner-only `/flags` command shows the current evaluations.
