import { snapshotEnv } from '@thesharks/test-utils'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'

// Runs only when DATABASE_URL points at a disposable Postgres with the
// migrations applied, e.g.:
//   docker run --rm -p 15432:5432 -e POSTGRES_PASSWORD=test postgres:17-alpine
//   DATABASE_URL=postgresql://postgres:test@localhost:15432/postgres \
//     pnpm --filter @thesharks/drizzle migrate && pnpm test
const databaseUrl = process.env.DATABASE_URL

const restoreEnv = snapshotEnv(['WILDBEAST_PREMIUM_SKUS'])
afterAll(restoreEnv)

describe.skipIf(!databaseUrl)('entitlement mirror (integration)', () => {
  // Imported lazily so loading this file without DATABASE_URL (the skip
  // path) never constructs the pg pool.
  async function setup() {
    const { db, entitlements, inArray } = await import('@thesharks/drizzle')
    const sync = await import('../src/premium/sync.mjs')
    const lookups = await import('../src/premium/entitlements.mjs')
    return { db, entitlements, inArray, ...sync, ...lookups }
  }

  // Every id this suite writes, so cleanup can't clobber foreign data.
  const OUR_IDS = Array.from({ length: 20 }, (_, i) => BigInt(9_000_100 + i))

  beforeEach(async () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium'
    const { db, entitlements, inArray } = await setup()
    await db.delete(entitlements).where(inArray(entitlements.id, OUR_IDS))
  })
  afterEach(async () => {
    delete process.env.WILDBEAST_PREMIUM_SKUS
    const { db, entitlements, inArray } = await setup()
    await db.delete(entitlements).where(inArray(entitlements.id, OUR_IDS))
  })

  const row = (
    id: bigint,
    overrides: Partial<{
      skuId: bigint
      userId: bigint | null
      guildId: bigint | null
      deleted: boolean
      startsAt: Date | null
      endsAt: Date | null
    }> = {},
  ) => ({
    id,
    skuId: 123n,
    userId: null,
    guildId: 9_000_500n,
    type: 8,
    deleted: false,
    startsAt: null,
    endsAt: null,
    ...overrides,
  })

  it('upserts by id, updating rather than duplicating', async () => {
    const { db, entitlements, inArray, upsertEntitlement } = await setup()

    await upsertEntitlement(row(OUR_IDS[0]!))
    await upsertEntitlement(row(OUR_IDS[0]!, { deleted: true }))

    const rows = await db
      .select()
      .from(entitlements)
      .where(inArray(entitlements.id, OUR_IDS))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: OUR_IDS[0], deleted: true })
  })

  it('reconciles by upserting fetched rows and soft-deleting the rest', async () => {
    const {
      db,
      entitlements,
      inArray,
      upsertEntitlement,
      reconcileEntitlements,
    } = await setup()

    // One stale mirror row Discord no longer returns, one that still lives.
    await upsertEntitlement(row(OUR_IDS[0]!))
    await upsertEntitlement(row(OUR_IDS[1]!))

    const fetched = [
      {
        id: OUR_IDS[1]!.toString(),
        skuId: '123',
        userId: null,
        guildId: '9000500',
        type: 8,
        deleted: false,
        startsAt: null,
        endsAt: null,
      },
      {
        id: OUR_IDS[2]!.toString(),
        skuId: '123',
        userId: null,
        guildId: '9000500',
        type: 8,
        deleted: false,
        startsAt: null,
        endsAt: null,
      },
    ]
    const client = {
      application: {
        entitlements: {
          fetch: async () => new Map(fetched.map((e) => [e.id, e])),
        },
      },
    } as never

    const live = await reconcileEntitlements(client)
    expect(live).toBe(2)

    const rows = await db
      .select()
      .from(entitlements)
      .where(inArray(entitlements.id, OUR_IDS))
    const byId = new Map(rows.map((r) => [r.id, r]))
    expect(byId.get(OUR_IDS[0]!)?.deleted).toBe(true)
    expect(byId.get(OUR_IDS[1]!)?.deleted).toBe(false)
    expect(byId.get(OUR_IDS[2]!)?.deleted).toBe(false)
  })

  it('resolves guild tiers from active mirrored rows only', async () => {
    const { upsertEntitlement, tierForGuild } = await setup()
    const guildId = 9_000_501n

    expect(await tierForGuild(guildId)).toBe('free')

    // Soft-deleted and expired rows must not grant anything.
    await upsertEntitlement(row(OUR_IDS[3]!, { guildId, deleted: true }))
    await upsertEntitlement(
      row(OUR_IDS[4]!, {
        guildId,
        endsAt: new Date(Date.now() - 60_000),
      }),
    )
    expect(await tierForGuild(guildId)).toBe('free')

    // A live row within its window grants the tier; null bounds are
    // perpetual.
    await upsertEntitlement(
      row(OUR_IDS[5]!, {
        guildId,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 60_000),
      }),
    )
    expect(await tierForGuild(guildId)).toBe('premium')
  })

  it('keeps user and guild subscriptions apart in mirror lookups', async () => {
    const { upsertEntitlement, tierForGuild, tierForUser } = await setup()
    const userId = 9_000_502n
    const guildId = 9_000_503n

    await upsertEntitlement(row(OUR_IDS[6]!, { guildId: null, userId }))
    expect(await tierForUser(userId)).toBe('premium')
    expect(await tierForGuild(guildId)).toBe('free')

    // A guild subscription bought by the user benefits the guild, not the
    // buyer personally.
    await upsertEntitlement(row(OUR_IDS[7]!, { guildId, userId }))
    expect(await tierForGuild(guildId)).toBe('premium')
    expect(await tierForUser(9_000_504n)).toBe('free')
  })

  it('grants nothing when premium is unconfigured', async () => {
    const { upsertEntitlement, tierForGuild } = await setup()
    const guildId = 9_000_505n
    await upsertEntitlement(row(OUR_IDS[8]!, { guildId }))

    delete process.env.WILDBEAST_PREMIUM_SKUS
    expect(await tierForGuild(guildId)).toBe('free')
  })
})
