import { type Attributes, metrics } from '@opentelemetry/api'
import type { Listener } from '@sapphire/framework'
import type { Guild } from 'discord.js'

export type {
  Context as OTelContext,
  Link as OTelLink,
  SpanContext as OTelSpanContext,
} from '@opentelemetry/api'
// Shared meter/name/type dedupes instruments across listener files.
export { context } from '@opentelemetry/api'

type AttributeValue = Attributes[keyof Attributes]

/** Second-scale buckets; SDK defaults collapse sub-5s measurements. */
export const DURATION_SECONDS_BOUNDARIES = [
  0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60,
]

/** Shard id from interaction guild, else piece container. */
export function resolveShardId(
  interaction?: { guild?: Guild | null },
  piece?: Pick<Listener, 'container'>,
): string {
  // Interaction guild is per-interaction accurate.
  if (interaction?.guild?.shardId !== undefined) {
    return interaction.guild.shardId.toString()
  }

  // Fall back to piece container shard.
  if (piece) {
    const shardId = piece.container.client.shard?.ids?.[0]
    if (typeof shardId === 'number') {
      return shardId.toString()
    }
  }

  return 'unknown'
}

function formatAttributeValue(value: AttributeValue): string {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).join(',')
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${key}:${String(entryValue)}`)
    return `{${entries.join(',')}}`
  }

  return String(value)
}

function buildAttributeKey(attributes: Attributes) {
  return Object.keys(attributes)
    .sort()
    .map((key) => `${key}:${formatAttributeValue(attributes[key])}`)
    .join('|')
}

/**
 * Frozen metrics/telemetry label contract (single source of truth).
 *
 * Maps every OTel metric name emitted by the bot to the full set of label
 * keys it may carry. Keys are the union across emitters: e.g. subcommand
 * listeners add `subcommand`, duration histograms add `duration_scope`,
 * boolean flag evaluations add `state`. A missing optional key on any
 * single point is fine; an unknown name or key is a contract break.
 *
 * Keep in sync with `docs/self-hosting/metrics.md` (contract table),
 * `contrib/grafana/dashboards/*.json` and `contrib/grafana/alerts.yaml`.
 * `scripts/check-metrics.mjs` (wired into CI) fails on any drift.
 */
export const METRIC_CONTRACT: Record<string, readonly string[]> = {
  discord_autocomplete_duration_seconds: ['command', 'scope', 'shard_id'],
  discord_autocomplete_interaction_total: ['command', 'scope', 'shard_id'],
  discord_bot_cpu_seconds: ['scope', 'type'],
  discord_bot_memory_usage_bytes: ['scope', 'type'],
  discord_bot_uptime_seconds: ['scope'],
  discord_button_duration_seconds: ['custom_id', 'scope', 'shard_id'],
  discord_button_interaction_total: ['custom_id', 'scope', 'shard_id'],
  discord_channels_total: ['scope'],
  discord_cluster_coordination_errors_total: [],
  discord_cluster_desired_shards: [],
  discord_cluster_epoch: [],
  discord_cluster_epoch_parked: [],
  discord_cluster_fenced: [],
  discord_cluster_members: [],
  discord_cluster_shard_handoffs_total: ['direction'],
  discord_command_denied_total: ['command', 'identifier', 'scope', 'shard_id'],
  discord_command_duration_seconds: [
    'command',
    'duration_scope',
    'scope',
    'shard_id',
    'subcommand',
  ],
  discord_command_errors_total: ['command', 'scope', 'shard_id', 'subcommand'],
  discord_commands_total: ['command', 'scope', 'shard_id', 'subcommand'],
  discord_context_command_duration_seconds: [
    'command',
    'duration_scope',
    'scope',
    'shard_id',
  ],
  discord_context_command_errors_total: ['command', 'scope', 'shard_id'],
  discord_context_commands_total: ['command', 'scope', 'shard_id'],
  discord_entitlement_backfill_errors_total: ['outcome'],
  discord_entitlement_reconcile_total: ['result'],
  discord_errors_total: ['error_type'],
  discord_experiment_exposures_total: ['experiment', 'source', 'variant'],
  discord_experiment_outcomes_total: [
    'experiment',
    'operation',
    'operation_kind',
    'outcome',
    'variant',
  ],
  discord_feature_flag_evaluation_duration_seconds: [
    'flag',
    'kind',
    'source',
    'state',
  ],
  discord_feature_flag_evaluations_total: ['flag', 'kind', 'source', 'state'],
  discord_feature_flags_expired: ['scope'],
  discord_gateway_events_total: ['shard_id', 'type'],
  discord_guild_member_total: ['scope'],
  discord_guild_tag_command_executions_total: ['outcome'],
  discord_guild_tag_command_promotions_total: ['action', 'trigger'],
  discord_guilds_total: ['scope'],
  discord_identifies_total: ['bucket'],
  discord_identify_wait_seconds: ['bucket'],
  discord_manager_shard_deaths_total: ['shard_id'],
  discord_manager_shard_errors_total: ['shard_id'],
  discord_manager_shard_launches_total: ['shard_id'],
  discord_manager_shard_up: ['shard_id'],
  discord_modal_submit_duration_seconds: ['custom_id', 'scope', 'shard_id'],
  discord_modal_submit_total: ['custom_id', 'scope', 'shard_id'],
  discord_premium_limit_override_fallbacks_total: ['key'],
  discord_rest_rate_limited_total: ['global', 'method', 'route'],
  discord_select_menu_duration_seconds: ['custom_id', 'scope', 'shard_id'],
  discord_select_menu_interaction_total: ['custom_id', 'scope', 'shard_id'],
  discord_shard_disconnect_total: ['clean', 'close_code', 'shard_id'],
  discord_shard_ready_total: ['shard_id'],
  discord_shard_reconnect_total: ['shard_id'],
  discord_shard_resume_total: ['shard_id'],
  discord_task_duration_seconds: ['status', 'task'],
  discord_tasks_total: ['status', 'task'],
  discord_warnings_total: ['error_type'],
  discord_websocket_latency_seconds: ['scope'],
  bullmq_queue_active: ['queue_name'],
  bullmq_queue_completed: ['queue_name'],
  bullmq_queue_delayed: ['queue_name'],
  bullmq_queue_failed: ['queue_name'],
  bullmq_queue_size: ['queue_name'],
  bullmq_queue_waiting: ['queue_name'],
  framework_errors_total: ['piece', 'source'],
  process_uncaught_exception_total: ['error_name', 'origin'],
  process_unhandled_rejection_total: ['error_name', 'reason_type'],
}

export type MetricContractName = keyof typeof METRIC_CONTRACT

/**
 * Sentry per-item metrics for rare events (guild joins/leaves, rate-limit
 * waits). Not OTel/PromQL; listed here so tests pin the same schema.
 */
export const SENTRY_METRIC_CONTRACT: Record<string, readonly string[]> = {
  'discord.guild.joined': ['member_count', 'shard_id'],
  'discord.guild.left': ['member_count', 'shard_id'],
  'discord.rest.rate_limit.wait': ['global', 'method', 'route'],
}

/**
 * Observable gauge with set/clear/reset; prefer set(0) over clear for dashboards (cumulative readers retain last value).
 */
export function createGauge(
  meterName: string,
  name: string,
  description: string,
  unit?: string,
) {
  const values = new Map<string, { value: number; attributes: Attributes }>()
  const meter = metrics.getMeter(meterName)
  const instrument = meter.createObservableGauge(name, { description, unit })

  instrument.addCallback((result) => {
    values.forEach((entry) => {
      result.observe(entry.value, entry.attributes)
    })
  })

  return {
    set(value: number, attributes: Attributes) {
      const key = buildAttributeKey(attributes)
      values.set(key, { value, attributes })
    },
    clear(attributes: Attributes) {
      const key = buildAttributeKey(attributes)
      values.delete(key)
    },
    reset() {
      values.clear()
    },
  }
}
