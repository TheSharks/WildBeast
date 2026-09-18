import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { container } from '@sapphire/framework'
import type { AppConfig } from '../src/runtime/config.mjs'
import type { AppServices } from '../src/runtime/services.mjs'
import type { ShardHost } from '../src/sharding/reconciler.mjs'

export type FakeAppOverrides = {
  [Service in keyof AppServices]?: Service extends 'config'
    ? Partial<AppConfig>
    : unknown
}

/**
 * Install a working `container.app` for a piece test and return it: an open
 * work scope and real flags, gates, experiments and premium (nobody has a
 * grant, no flag provider). Pass whatever else the piece calls, such as
 * `tags`, as overrides; `config` overrides merge into the defaults.
 *
 * The services load here, not at the top of this file: a test that captures
 * metrics must register its provider before these modules create instruments.
 */
export async function installFakeApp(
  overrides: FakeAppOverrides = {},
): Promise<AppServices> {
  const { Experiments } = await import('../src/features/experiments.mjs')
  const { FeatureFlags } = await import('../src/features/flags.mjs')
  const { CommandGates } = await import('../src/features/gates.mjs')
  const { PremiumService } = await import('../src/premium/service.mjs')
  const { WorkScope } = await import('../src/runtime/work.mjs')

  const { config, ...services } = overrides
  const work = new WorkScope()
  work.open()
  const flags = (services.flags as AppServices['flags']) ?? new FeatureFlags()
  const premiumSkus = config?.premiumSkus ?? new Map()
  const premium =
    (services.premium as AppServices['premium']) ??
    new PremiumService(
      {
        state: async () => ({ revision: 0n, completedAt: null }),
        forOwner: async () => ({
          grants: [],
          state: { revision: 0n, completedAt: null },
        }),
        write: async () => undefined,
        replace: async () => true,
      },
      premiumSkus,
    )
  const app = {
    config: {
      devGuildId: null,
      ownerIds: new Set<bigint>(),
      shardIds: [0],
      premiumSkus,
      premiumCatalog: new Map(),
      ...config,
    },
    work,
    flags,
    premium,
    gates: new CommandGates(flags, premium),
    experiments: new Experiments(flags),
    commandIds: { hintsFor: async () => [] },
    ...services,
  } as unknown as AppServices
  container.app = app
  return app
}

/** The context Sapphire's loader passes to a piece constructor. */
export function loaderContext<Context>(
  name: string,
  store: unknown,
  file: string = import.meta.url,
): Context {
  const path = fileURLToPath(file)
  return { name, path, root: dirname(path), store } as Context
}

/** In-memory ShardHost: shard lifecycle without discord.js. */
export class FakeHost implements ShardHost {
  public readonly shards = new Set<number>()

  public currentShards(): number[] {
    return [...this.shards]
  }

  public isAlive(shardId: number): boolean {
    return this.shards.has(shardId)
  }

  public async start(shardId: number): Promise<void> {
    this.shards.add(shardId)
  }

  public async stop(shardId: number): Promise<void> {
    this.shards.delete(shardId)
  }
}
