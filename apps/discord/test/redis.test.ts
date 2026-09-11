import { expect, it } from 'vitest'
import { redisConnectionOptions } from '../src/utils/redis.mjs'

it.each(['redis', 'rediss'])(
  'parses %s IPv6 literals for Node connections',
  (protocol) => {
    expect(
      redisConnectionOptions({ REDIS_URL: `${protocol}://[::1]:6380/2` }),
    ).toEqual({
      host: '::1',
      port: 6380,
      db: 2,
      ...(protocol === 'rediss' ? { tls: {} } : {}),
    })
  },
)
