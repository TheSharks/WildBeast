import { Writable } from 'node:stream'
import { LogLevel } from '@sapphire/framework'
import { captureLogRecords } from '@thesharks/test-utils'
import { describe, expect, it } from 'vitest'
import { AnalyticsLogger } from '../src/bridges/sapphire-logger.js'

// Must be installed before any AnalyticsLogger acquires its OTEL logger.
const capture = captureLogRecords()

// Swallow the console side of the logger; only the OTEL side is under test.
const sink = new Writable({
  write(_chunk, _encoding, callback) {
    callback()
  },
})

function makeLogger(level: LogLevel = LogLevel.Info): AnalyticsLogger {
  return new AnalyticsLogger({ level, stdout: sink, stderr: sink })
}

describe('AnalyticsLogger OTEL bridge', () => {
  it('forwards logs at or above the configured level', () => {
    capture.reset()
    makeLogger().info('hello', 'world')

    const records = capture.records()
    expect(records).toHaveLength(1)
    expect(records[0].body).toBe('hello world')
    expect(records[0].severityText).toBe('Info')
    expect(records[0].severityNumber).toBe(9)
    expect(records[0].attributes).toMatchObject({
      source: 'sapphire-logger',
      originalLevel: 'Info',
    })
  })

  it('drops logs below the configured level', () => {
    capture.reset()
    makeLogger().debug('should not leave the process')
    expect(capture.records()).toHaveLength(0)
  })

  it('honors a lower configured level', () => {
    capture.reset()
    makeLogger(LogLevel.Trace).trace('very verbose')
    expect(capture.records()).toHaveLength(1)
    expect(capture.records()[0].severityText).toBe('Trace')
  })

  it('formats non-string values with inspect instead of String()', () => {
    capture.reset()
    makeLogger().warn('context:', { answer: 42 })

    const [record] = capture.records()
    expect(record.body).toBe('context: { answer: 42 }')
    expect(record.severityText).toBe('Warn')
    expect(record.severityNumber).toBe(13)
  })

  it('maps error and fatal severities', () => {
    capture.reset()
    const logger = makeLogger()
    logger.error('boom')
    logger.fatal('dead')

    const [error, fatal] = capture.records()
    expect(error.severityNumber).toBe(17)
    expect(fatal.severityNumber).toBe(21)
  })

  it('redacts denylisted keys from structured values', () => {
    capture.reset()
    makeLogger().info('login', {
      username: 'someone',
      token: 'secret-token',
      safe: 'ok',
    })

    const [record] = capture.records()
    expect(record.body).toContain('[Redacted]')
    expect(record.body).toContain('ok')
    expect(record.body).not.toContain('someone')
    expect(record.body).not.toContain('secret-token')
  })

  it('redacts bearer secrets in free-form text', () => {
    capture.reset()
    makeLogger().info('auth Bearer abcdef12345')

    const [record] = capture.records()
    expect(record.body).toContain('Bearer [Redacted]')
    expect(record.body).not.toContain('abcdef12345')
  })

  it('preserves Error message, stack and cause', () => {
    capture.reset()
    makeLogger().error(
      new Error('outer boom', { cause: new Error('inner cause') }),
    )

    const [record] = capture.records()
    expect(record.body).toContain('outer boom')
    expect(record.body).toContain('inner cause')
    expect(record.body).toMatch(/at /)
  })

  it('formats Dates as ISO strings', () => {
    capture.reset()
    makeLogger().info('at', new Date('2026-01-01T00:00:00.000Z'))

    const [record] = capture.records()
    expect(record.body).toContain('2026-01-01T00:00:00.000Z')
  })

  it('converts Maps and Sets to inspectable entries', () => {
    capture.reset()
    makeLogger().info(
      'm',
      new Map<string, unknown>([
        ['answer', 42],
        ['token', 'secret-token'],
      ]),
    )

    const [mapRecord] = capture.records()
    expect(mapRecord.body).toContain('answer')
    expect(mapRecord.body).toContain('42')
    expect(mapRecord.body).toContain('[Redacted]')
    expect(mapRecord.body).not.toContain('secret-token')

    capture.reset()
    makeLogger().info('s', new Set(['a', 'b']))

    const [setRecord] = capture.records()
    expect(setRecord.body).toContain('a')
    expect(setRecord.body).toContain('b')
  })
})
