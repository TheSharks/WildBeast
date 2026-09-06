---
title: Metrics reference
description: Every metric WildBeast exports, with labels.
sidebar:
  order: 9
---

All metrics are exported over OTLP once an endpoint is configured (see
[Telemetry](/self-hosting/telemetry/)). Durations are histograms in
seconds with bucket boundaries tuned for sub-minute operations. A handful
of rare, per-event measurements (guild joins and leaves, rate-limit waits)
live in [Sentry metrics](/self-hosting/telemetry/#sentry) instead and are
not listed here.

## Commands and interactions

Emitted by shard processes (`service.name = @thesharks/discord`).

| Metric | Type | Labels |
| --- | --- | --- |
| `discord_commands_total` | counter | `command`, `shard_id`, `scope` |
| `discord_command_errors_total` | counter | `command`, `shard_id`, `scope` |
| `discord_command_duration_seconds` | histogram | `command`, `shard_id`, `scope` |
| `discord_command_denied_total` | counter | `command`, `identifier`, `shard_id`, `scope` |
| `discord_context_commands_total` / `discord_context_command_errors_total` / `discord_context_command_duration_seconds` | — | as above |
| `discord_button_interaction_total` / `discord_button_duration_seconds` | — | `custom_id`, `shard_id`, `scope` |
| `discord_select_menu_interaction_total` / `discord_select_menu_duration_seconds` | — | `custom_id`, `shard_id`, `scope` |
| `discord_modal_submit_total` / `discord_modal_submit_duration_seconds` | — | `custom_id`, `shard_id`, `scope` |
| `discord_autocomplete_interaction_total` / `discord_autocomplete_duration_seconds` | — | `command`, `shard_id`, `scope` |
| `discord_guild_tag_command_promotions_total` | counter | `action` (`promote`, `demote`), `trigger` (`command`, `reconcile`, `tagDelete`, `orphanCleanup`) |
| `discord_guild_tag_command_executions_total` | counter | `outcome` (`success`, `renderError`, `emptyOutput`, `orphaned`) |

`scope` is `guild` or `dm`; `identifier` is the precondition that denied the
command; component `custom_id` labels use the prefix before the first `:`
so dynamic ids don't explode cardinality.

## Runtime flags and experiments

Flag keys and experiment variants come from the bounded
[typed registry](/development/features/#the-typed-registry); user and guild ids
are targeting context and never metric labels.

| Metric | Type | Labels |
| --- | --- | --- |
| `discord_feature_flag_evaluations_total` | counter | `flag`, `kind` (`gate`, `experiment`, `limit`), `source` (`default`, `provider`, `cache`, `error`), and `state` for boolean gates |
| `discord_feature_flag_evaluation_duration_seconds` | histogram | same as the evaluation counter |
| `discord_experiment_exposures_total` | counter | `experiment`, `variant`, `source` (`default`, `provider`, `cache`, `error`, `invalid`) |
| `discord_experiment_outcomes_total` | counter | `experiment`, `variant`, `outcome` (`success`, `error`), `operation_kind`, `operation` |
| `discord_feature_flags_expired` | gauge | `scope` |

An exposure is recorded once per experiment per command/task run, even if the
assignment is read more than once. Outcomes are technical execution results,
not product conversion events. The expired gauge counts registry entries past
their `expiresAt` date, so a forgotten temporary flag shows up on dashboards
instead of only in a boot log line.

## Gateway and sessions

These track the websocket connections themselves: traffic, lifecycle events,
and the identify rate limit budget.

| Metric | Type | Labels |
| --- | --- | --- |
| `discord_gateway_events_total` | counter | `type` (dispatch name or opcode), `shard_id` |
| `discord_shard_ready_total` / `_reconnect_total` / `_resume_total` | counter | `shard_id` |
| `discord_shard_disconnect_total` | counter | `shard_id`, `close_code`, `clean` |
| `discord_websocket_latency_seconds` | gauge | — |
| `discord_identifies_total` | counter | `bucket` |
| `discord_identify_wait_seconds` | histogram | `bucket` |
| `discord_rest_rate_limited_total` | counter | `route`, `method`, `global` |

`discord_shard_resume_total` counts resumed sessions, including handoffs
between clusters, which resume instead of identifying.

## Errors and process health

Failures at every level, from Discord API errors down to uncaught
exceptions, plus the process vitals.

| Metric | Type | Labels |
| --- | --- | --- |
| `discord_warnings_total` / `discord_errors_total` | counter | — / `error_type` |
| `framework_errors_total` | counter | `source`, `piece` |
| `process_uncaught_exception_total` | counter | `origin`, `error_name` |
| `process_unhandled_rejection_total` | counter | `error_name` |
| `discord_bot_uptime_seconds` | gauge | — |
| `discord_bot_memory_usage_bytes` | gauge | `type` (`heap_used`, `heap_total`, `rss`) |
| `discord_bot_cpu_seconds` | counter | `type` (`user`, `system`) |
| `discord_guilds_total` / `discord_guild_member_total` / `discord_channels_total` | gauge | — |

Node runtime metrics (`nodejs.eventloop.*`, `v8js.gc.*`,
`v8js.memory.heap.*`) are emitted by the runtime instrumentation.

## Scheduled tasks

Recurring background work and the BullMQ queue backing it. A `deferred`
status means a worker handed a cluster-dependent job back to the queue
because it doesn't own the required shard; it isn't a failure.

| Metric | Type | Labels |
| --- | --- | --- |
| `discord_tasks_total` | counter | `task`, `status` (`success`, `error`, `deferred`) |
| `discord_task_duration_seconds` | histogram | `task`, `status` |
| `bullmq_queue_size` / `_active` / `_waiting` / `_delayed` / `_failed` / `_completed` | gauge | `queue_name` |

## Cluster manager

Emitted by manager processes (`service.name = @thesharks/discord-manager`).

| Metric | Type | Labels |
| --- | --- | --- |
| `discord_manager_shard_up` | gauge | `shard_id` |
| `discord_manager_shard_launches_total` / `_deaths_total` / `_errors_total` | counter | `shard_id` |
| `discord_cluster_members` | gauge | — |
| `discord_cluster_desired_shards` | gauge | — |
| `discord_cluster_shard_handoffs_total` | counter | `direction` (`acquired`, `released`, `lost`) |
| `discord_cluster_coordination_errors_total` | counter | — |
| `discord_cluster_fenced` | gauge | — |
| `discord_cluster_epoch` / `discord_cluster_epoch_parked` | gauge | — |

Good alerting starters: `discord_manager_shard_up == 0` for any shard,
`discord_cluster_fenced == 1`, a rising
`discord_cluster_coordination_errors_total`, and
`discord_rest_rate_limited_total{global="true"}`.
