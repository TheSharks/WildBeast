# WildBeast rebuild

Status: complete. The rebuilt application is `apps/discord/src`; the previous
implementation has been removed. Sapphire stays, including its scheduled-tasks
plugin (BullMQ on Redis) as the job scheduler. The rebuild did not replace
TagScript or the analytics package.

## Boundaries

- Sapphire pieces own Discord input, localization, acknowledgements and replies.
- Feature services own authorization, limits, and workflows. Dependencies are
  passed at construction; services do not read Sapphire's container or process
  environment, create connections, or register listeners on import.
- Adapters own PostgreSQL, Redis, Discord REST/gateway and feature providers.
- The runtime owns configuration (`runtime/config.mts`), resource construction
  (`runtime/composition.mts`), admission of work (`runtime/work.mts`), readiness
  and ordered teardown (`runtime/application.mts`). Scheduled tasks are pieces
  on the queue; `structures/task.mts` admits, gates, routes and traces them.
  The fleet manager (`fleet/`) owns shard workers, epochs, leases and handoffs.

Pieces reach services only through `container.app` (`runtime/services.mts`),
which the runtime installs before the client logs in.

## Guarantees and evidence

| Area | Guarantee | Evidence |
| --- | --- | --- |
| Startup | Environment is validated before any connection opens; the database schema is checked before Redis or Discord; a failed factory unwinds every earlier resource; work is admitted only once every resource is open. | `runtime.test.ts`, `composition.test.ts`; boot smoke of `dist/main.mjs` with a missing environment and with an invalid token against live PostgreSQL and Redis. |
| Shutdown | Admission closes first, admitted work drains within a deadline, then the task queue worker, gateway, sessions, flags, Redis, database and telemetry close in reverse order. Repeated stop requests join one operation. A drain timeout leaves storage open and exits non-zero. A stopping worker defers queued jobs and answers new interactions instead of letting them expire. | `runtime.test.ts`, `composition.test.ts`, `tasks.test.ts`, `tagCommand.test.ts`. |
| Handoff | A handoff close stops gateway processing with a resumable close code, keeps the final sequence, flushes the session store, and only then releases the worker. Shutdown invalidates the persisted session. | `handoff.test.ts`, `composition.test.ts`, `fleet.test.ts`. |
| Ownership | A worker serves only while its lease is valid; coordination failure fences it within the TTL safety window; a stale epoch configuration exits. Cluster-dependent jobs run only on the worker owning the declared shard. | `reconciler.test.ts`, `epochs.test.ts`, `epochs.integration.test.ts`, `reconciler.integration.test.ts`, `fleet.test.ts`, `tasks.test.ts`. |
| Migrations | Existing installations upgrade without losing owners, tags or promotions; clean installs and repeated migrator runs succeed; the application refuses to start on an unmigrated schema. | Migrations 0006 to 0011 (`entitlementMigration.integration.test.ts`, `tags.integration.test.ts`), fresh migrate plus repeated run against disposable PostgreSQL, `composition.test.ts`. |
| Entitlements | Interaction grants are authoritative for that interaction; guild grants never raise user limits. Background revocation requires a fresh completed full snapshot; empty snapshots count; failed, incomplete or superseded snapshots do not. Gateway events and snapshots share one repository revision. A snapshot runs at boot and every 6 hours on the shard 0 worker. | `premium.test.ts`, `premium.integration.test.ts`, `entitlementSource.test.ts`, `gates.test.ts`. |
| Tags | Every read and write is guild scoped; authors or managers edit and delete; managers promote and demote; creates and promotions enforce caps under concurrent requests. | `tags.integration.test.ts`, `tagCommand.test.ts`. |
| Promoted commands | Durable intents survive REST and database failure windows; reconciliation serializes with user writes through the guild lock and touches only commands owned by intents; over-cap revocation waits for a fresh snapshot. | `tags.integration.test.ts`. |
| Features | Command gates, limits, experiments, component authorization, error replies and telemetry are shared services used by every entry surface. | `flags.test.ts`, `gates.test.ts`, `flagsInspect.test.ts`, `metricsListeners.test.ts`, `structure.test.ts`, `scripts/check-metrics.mjs`. |

## Behavior changes from the previous implementation

- Promotion and demotion record durable intent and then run the guild repair
  immediately; the user sees the real Discord outcome and a failed request is
  retried by the nightly repair. A new reply (`promoteCleanupPending`) covers a
  name whose previous command is still being removed. Deleting a promoted tag
  removes its command in the background.
- The boot entitlement snapshot is a one-off queued job with queue retries
  instead of an in-process retry loop.
- Scheduled tasks declare `requiresShard` for cluster-dependent work; a
  non-owner defers the job (`discord_tasks_total{status="deferred"}`) rather
  than running it.
- Operator commands (`/flags`) are no longer registered globally. Pieces
  declare `scope: 'operator'`; the definition is captured instead of
  registered and placed per guild (`WILDBEAST_OPERATOR_GUILD_IDS` plus the
  `operators.commandGuilds` setting) by the `operatorCommandReconcile` task,
  through per-command REST so promoted tag commands are never overwritten.
- The development-only HMR plugin was not carried over.

## Removed with the cutover

- `src/index.mts`, `src/cluster.mts`, `src/commands/slash`, the top-level
  `listeners`, `scheduled-tasks`, `interaction-handlers`, `preconditions`,
  `structures`, `premium`, `features` and most of `utils`, plus their tests.
- Migration 0011 drops the `Tag_legacy_promotion_intent` trigger that mirrored
  direct `Tag` promotions into intents while both runtimes coexisted.
