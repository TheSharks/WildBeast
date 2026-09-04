import type * as Sentry from '@sentry/node'

export type MonitorConfig = NonNullable<
  Parameters<typeof Sentry.withMonitor>[2]
>

export interface TaskSchedule {
  interval: number | null
  pattern: string | null
  timezone: string
}

/** Piece name to Sentry monitor slug (lowercase [a-z0-9_-], max 50). */
export function monitorSlug(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

/** Sentry monitor from task schedule; null when inexpressible (manual, sub-minute, non-whole-minute). */
export function monitorConfigFromSchedule(
  schedule: TaskSchedule,
): MonitorConfig | null {
  if (schedule.pattern) {
    return {
      schedule: { type: 'crontab', value: schedule.pattern },
      timezone: schedule.timezone,
    }
  }

  if (
    schedule.interval &&
    schedule.interval >= 60_000 &&
    schedule.interval % 60_000 === 0
  ) {
    return {
      schedule: {
        type: 'interval',
        unit: 'minute',
        value: schedule.interval / 60_000,
      },
    }
  }

  return null
}
