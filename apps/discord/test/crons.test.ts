import { describe, expect, it } from 'vitest'
import { monitorConfigFromSchedule, monitorSlug } from '../src/utils/crons.mjs'

describe('monitorSlug', () => {
  it('kebab-cases camelCase piece names', () => {
    expect(monitorSlug('metricsCollection')).toBe('metrics-collection')
    expect(monitorSlug('bullMQMetrics')).toBe('bull-mqmetrics')
  })

  it('strips characters Sentry rejects', () => {
    expect(monitorSlug('weird name!')).toBe('weird-name')
    expect(monitorSlug('--edges--')).toBe('edges')
  })

  it('caps the slug at 50 characters', () => {
    expect(monitorSlug('a'.repeat(80))).toHaveLength(50)
  })
})

describe('monitorConfigFromSchedule', () => {
  it('maps cron patterns to crontab schedules with the task timezone', () => {
    expect(
      monitorConfigFromSchedule({
        interval: null,
        pattern: '0 2 * * *',
        timezone: 'Etc/UTC',
      }),
    ).toStrictEqual({
      schedule: { type: 'crontab', value: '0 2 * * *' },
      timezone: 'Etc/UTC',
    })
  })

  it('maps whole-minute intervals to interval schedules', () => {
    expect(
      monitorConfigFromSchedule({
        interval: 300_000,
        pattern: null,
        timezone: 'Etc/UTC',
      }),
    ).toStrictEqual({
      schedule: { type: 'interval', unit: 'minute', value: 5 },
    })
  })

  it('prefers the pattern when both are set', () => {
    expect(
      monitorConfigFromSchedule({
        interval: 60_000,
        pattern: '* * * * *',
        timezone: 'Etc/UTC',
      }),
    ).toMatchObject({ schedule: { type: 'crontab' } })
  })

  it('returns null for schedules Sentry cannot express', () => {
    // Manual, payload-driven tasks have no schedule at all.
    expect(
      monitorConfigFromSchedule({
        interval: null,
        pattern: null,
        timezone: 'Etc/UTC',
      }),
    ).toBeNull()
    // Sentry's smallest schedule unit is one minute.
    expect(
      monitorConfigFromSchedule({
        interval: 30_000,
        pattern: null,
        timezone: 'Etc/UTC',
      }),
    ).toBeNull()
    expect(
      monitorConfigFromSchedule({
        interval: 90_000,
        pattern: null,
        timezone: 'Etc/UTC',
      }),
    ).toBeNull()
  })
})
