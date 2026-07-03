import { describe, expect, it } from 'vitest'
import { validateEnv } from '../src/env.mjs'

describe('validateEnv', () => {
  it('requires a token', () => {
    expect(() => validateEnv({})).toThrow(/DISCORD_TOKEN/)
  })

  it('accepts the legacy BOT_TOKEN alias', () => {
    expect(validateEnv({ BOT_TOKEN: 'legacy-token' })).toMatchObject({
      DISCORD_TOKEN: 'legacy-token',
    })
  })

  it('prefers DISCORD_TOKEN over the alias', () => {
    expect(
      validateEnv({ DISCORD_TOKEN: 'primary', BOT_TOKEN: 'legacy' }),
    ).toMatchObject({ DISCORD_TOKEN: 'primary' })
  })

  it('treats empty strings as absent', () => {
    expect(() => validateEnv({ DISCORD_TOKEN: '' })).toThrow(/DISCORD_TOKEN/)
    expect(
      validateEnv({ DISCORD_TOKEN: 'token', REDIS_PORT: '' }).REDIS_PORT,
    ).toBeUndefined()
  })

  it('coerces numeric variables', () => {
    expect(
      validateEnv({
        DISCORD_TOKEN: 'token',
        REDIS_PORT: '16379',
        WILDBEAST_SHARDING_TOTAL: '8',
      }),
    ).toMatchObject({ REDIS_PORT: 16_379, WILDBEAST_SHARDING_TOTAL: 8 })
  })

  it('rejects malformed values with a readable message', () => {
    expect(() =>
      validateEnv({ DISCORD_TOKEN: 'token', REDIS_PORT: 'not-a-port' }),
    ).toThrow(/Invalid environment/)
    expect(() =>
      validateEnv({ DISCORD_TOKEN: 'token', SENTRY_DSN: 'not-a-url' }),
    ).toThrow(/SENTRY_DSN/)
    expect(() =>
      validateEnv({
        DISCORD_TOKEN: 'token',
        WILDBEAST_CLUSTERING_MODE: 'chaotic',
      }),
    ).toThrow(/WILDBEAST_CLUSTERING_MODE/)
  })
})
