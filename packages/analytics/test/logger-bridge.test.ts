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
})
