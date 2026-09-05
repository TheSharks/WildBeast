import { describe, expect, it } from 'vitest'
import { validateEnv } from '../src/env.mjs'

const database = { DATABASE_URL: 'postgresql://localhost/wildbeast' }

describe('validateEnv', () => {
  it('requires a token', () => {
    expect(() => validateEnv(database)).toThrow(/DISCORD_TOKEN/)
  })

  it('requires the database URL at boot', () => {
    expect(() => validateEnv({ DISCORD_TOKEN: 'token' })).toThrow(
      /DATABASE_URL/,
    )
  })

  it('rejects a database URL that is not postgres', () => {
    expect(() =>
      validateEnv({
        DISCORD_TOKEN: 'token',
        DATABASE_URL: 'mysql://localhost/wildbeast',
      }),
    ).toThrow(/postgres/)
    expect(
      validateEnv({
        DISCORD_TOKEN: 'token',
        DATABASE_URL: 'postgres://localhost/wildbeast',
      }),
    ).toMatchObject({ DATABASE_URL: 'postgres://localhost/wildbeast' })
  })

  it('refuses a dev guild on a production bot', () => {
    // Bulk-overwrite registration would remove every global command.
    expect(() =>
      validateEnv({
        ...database,
        DISCORD_TOKEN: 'token',
        NODE_ENV: 'production',
        WILDBEAST_DEV_GUILD_ID: '1315790123456789',
      }),
    ).toThrow(/WILDBEAST_DEV_GUILD_ID/)
    expect(
      validateEnv({
        ...database,
        DISCORD_TOKEN: 'token',
        NODE_ENV: 'development',
        WILDBEAST_DEV_GUILD_ID: '1315790123456789',
      }),
    ).toMatchObject({ WILDBEAST_DEV_GUILD_ID: '1315790123456789' })
  })

  it('accepts the legacy BOT_TOKEN alias', () => {
    expect(
      validateEnv({ ...database, BOT_TOKEN: 'legacy-token' }),
    ).toMatchObject({
      DISCORD_TOKEN: 'legacy-token',
    })
  })

  it('prefers DISCORD_TOKEN over the alias', () => {
    expect(
      validateEnv({
        ...database,
        DISCORD_TOKEN: 'primary',
        BOT_TOKEN: 'legacy',
      }),
    ).toMatchObject({ DISCORD_TOKEN: 'primary' })
  })

  it('treats empty strings as absent', () => {
    expect(() => validateEnv({ ...database, DISCORD_TOKEN: '' })).toThrow(
      /DISCORD_TOKEN/,
    )
    expect(
      validateEnv({
        ...database,
        DISCORD_TOKEN: 'token',
        REDIS_PORT: '',
      }).REDIS_PORT,
    ).toBeUndefined()
  })

  it('coerces numeric variables', () => {
    expect(
      validateEnv({
        ...database,
        DISCORD_TOKEN: 'token',
        REDIS_PORT: '16379',
        WILDBEAST_SHARDING_TOTAL: '8',
      }),
    ).toMatchObject({ REDIS_PORT: 16_379, WILDBEAST_SHARDING_TOTAL: 8 })
  })

  it('rejects malformed values with a readable message', () => {
    expect(() =>
      validateEnv({
        ...database,
        DISCORD_TOKEN: 'token',
        REDIS_PORT: 'not-a-port',
      }),
    ).toThrow(/Invalid environment/)
    expect(() =>
      validateEnv({
        ...database,
        DISCORD_TOKEN: 'token',
        SENTRY_DSN: 'not-a-url',
      }),
    ).toThrow(/SENTRY_DSN/)
    expect(() =>
      validateEnv({
        ...database,
        DISCORD_TOKEN: 'token',
        WILDBEAST_CLUSTERING_MODE: 'chaotic',
      }),
    ).toThrow(/WILDBEAST_CLUSTERING_MODE/)
  })

  it('accepts a REDIS_URL override and rejects other schemes', () => {
    expect(
      validateEnv({
        ...database,
        DISCORD_TOKEN: 'token',
        REDIS_URL: 'redis://localhost:6379',
      }),
    ).toMatchObject({ REDIS_URL: 'redis://localhost:6379' })
    expect(() =>
      validateEnv({
        ...database,
        DISCORD_TOKEN: 'token',
        REDIS_URL: 'http://localhost:6379',
      }),
    ).toThrow(/REDIS_URL/)
  })

  it('bounds REDIS_DB to the Redis 0-16383 range', () => {
    expect(
      validateEnv({ ...database, DISCORD_TOKEN: 'token', REDIS_DB: '3' }),
    ).toMatchObject({ REDIS_DB: 3 })
    // Defaults ship 16 databases, but `databases` can raise it to 16383.
    expect(
      validateEnv({ ...database, DISCORD_TOKEN: 'token', REDIS_DB: '16' }),
    ).toMatchObject({ REDIS_DB: 16 })
    expect(
      validateEnv({ ...database, DISCORD_TOKEN: 'token', REDIS_DB: '16383' }),
    ).toMatchObject({ REDIS_DB: 16_383 })
    expect(() =>
      validateEnv({ ...database, DISCORD_TOKEN: 'token', REDIS_DB: '16384' }),
    ).toThrow(/Invalid environment/)
    expect(() =>
      validateEnv({ ...database, DISCORD_TOKEN: 'token', REDIS_DB: '-1' }),
    ).toThrow(/Invalid environment/)
  })

  it('validates WILDBEAST_EPOCH numerically', () => {
    expect(
      validateEnv({
        ...database,
        DISCORD_TOKEN: 'token',
        WILDBEAST_EPOCH: '4',
      }),
    ).toMatchObject({ WILDBEAST_EPOCH: 4 })
    expect(() =>
      validateEnv({
        ...database,
        DISCORD_TOKEN: 'token',
        WILDBEAST_EPOCH: '-1',
      }),
    ).toThrow(/Invalid environment/)
  })

  it('validates the premium SKU mapping', () => {
    expect(
      validateEnv({
        ...database,
        DISCORD_TOKEN: 'token',
        WILDBEAST_PREMIUM_SKUS: '1315790123456789:premium',
      }),
    ).toMatchObject({ WILDBEAST_PREMIUM_SKUS: '1315790123456789:premium' })
    expect(() =>
      validateEnv({
        ...database,
        DISCORD_TOKEN: 'token',
        WILDBEAST_PREMIUM_SKUS: '1315790123456789:gold',
      }),
    ).toThrow(/Unknown premium tier/)
  })
})
