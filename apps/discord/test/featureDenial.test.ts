import { EventEmitter } from 'node:events'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  container,
  type InteractionHandler,
  InteractionHandlerStore,
  InteractionHandlerTypes,
  ListenerStore,
} from '@sapphire/framework'
import { silentLogger } from '@thesharks/test-utils'
import { MessageFlags } from 'discord.js'
import { describe, expect, it, vi } from 'vitest'
import { FeaturePreconditionIdentifier } from '../src/preconditions/Feature.mjs'
import { PremiumPreconditionIdentifier } from '../src/preconditions/Premium.mjs'

vi.mock('@sapphire/plugin-i18next', async () => {
  const actual = await vi.importActual('@sapphire/plugin-i18next')
  return {
    ...actual,
    resolveKey: vi.fn(async (_interaction, key) => key),
  }
})

vi.mock('../src/features/gates.mjs', () => ({
  commandComponentEnabled: vi.fn(async () => true),
}))

const { CommandDeniedReplyListener, ContextMenuCommandDeniedReplyListener } =
  await import('../src/listeners/reporting/commandDeniedReply.mjs')
const { commandComponentEnabled } = vi.mocked(
  await import('../src/features/gates.mjs'),
)
const { GatedCommandInteractionHandler } = await import(
  '../src/structures/interactionHandler.mjs'
)

container.client = new EventEmitter() as never
container.logger = silentLogger

describe('feature gate denial reply', () => {
  it('turns a feature precondition denial into a localized ephemeral reply', async () => {
    const listener = new CommandDeniedReplyListener(
      {
        name: 'commandDeniedReply',
        path: fileURLToPath(import.meta.url),
        root: dirname(fileURLToPath(import.meta.url)),
        store: new ListenerStore(),
      } as never,
      {},
    )
    const reply = vi.fn(async () => undefined)

    await listener.run(
      {
        identifier: FeaturePreconditionIdentifier,
        context: { key: 'features.commands.booru' },
        message: 'This command is temporarily unavailable.',
      } as never,
      {
        interaction: {
          replied: false,
          deferred: false,
          reply,
        },
      } as never,
    )

    expect(reply).toHaveBeenCalledWith({
      content: 'system/errors:feature_unavailable',
      flags: MessageFlags.Ephemeral,
    })
  })

  it('also replies to context-menu precondition denials', async () => {
    const listener = new ContextMenuCommandDeniedReplyListener(
      {
        name: 'contextMenuCommandDeniedReply',
        path: fileURLToPath(import.meta.url),
        root: dirname(fileURLToPath(import.meta.url)),
        store: new ListenerStore(),
      } as never,
      {},
    )
    const reply = vi.fn(async () => undefined)

    await listener.run(
      {
        identifier: FeaturePreconditionIdentifier,
        context: { key: 'features.commands.future-context-command' },
        message: 'This command is temporarily unavailable.',
      } as never,
      {
        interaction: { replied: false, deferred: false, reply },
      } as never,
    )

    expect(reply).toHaveBeenCalledWith({
      content: 'system/errors:feature_unavailable',
      flags: MessageFlags.Ephemeral,
    })
  })
})

describe('premium gate denial reply', () => {
  it('turns a premium precondition denial into a localized upsell reply', async () => {
    const listener = new CommandDeniedReplyListener(
      {
        name: 'commandDeniedReply',
        path: fileURLToPath(import.meta.url),
        root: dirname(fileURLToPath(import.meta.url)),
        store: new ListenerStore(),
      } as never,
      {},
    )
    const reply = vi.fn(async () => undefined)

    await listener.run(
      {
        identifier: PremiumPreconditionIdentifier,
        context: {
          requiredTier: 'premium',
          requiredScope: 'guild',
          currentTier: 'free',
        },
        message: 'This command requires a premium subscription.',
      } as never,
      {
        interaction: {
          guildId: '500',
          replied: false,
          deferred: false,
          reply,
        },
      } as never,
    )

    expect(reply).toHaveBeenCalledWith({
      content: expect.stringContaining('system/errors:premium_required'),
      components: undefined,
      flags: MessageFlags.Ephemeral,
    })
  })
})

describe('gated interaction handler denial', () => {
  class FixtureHandler extends GatedCommandInteractionHandler {
    public ran = vi.fn()

    public constructor() {
      super(
        {
          name: 'fixtureHandler',
          path: fileURLToPath(import.meta.url),
          root: dirname(fileURLToPath(import.meta.url)),
          store: new InteractionHandlerStore(),
        } as never,
        {
          command: 'booru',
          interactionHandlerType: InteractionHandlerTypes.Button,
        },
      )
    }

    public override parse(): InteractionHandler.Option {
      return this.some()
    }

    public override run() {
      this.ran()
    }
  }

  const componentInteraction = (reply: ReturnType<typeof vi.fn>) =>
    ({
      isMessageComponent: () => true,
      replied: false,
      deferred: false,
      reply,
    }) as never

  it('replies with the localized denial instead of running the handler', async () => {
    commandComponentEnabled.mockResolvedValueOnce(false)
    const handler = new FixtureHandler()
    const reply = vi.fn(async () => undefined)

    await handler.run(componentInteraction(reply))

    expect(handler.ran).not.toHaveBeenCalled()
    expect(reply).toHaveBeenCalledWith({
      content: 'system/errors:feature_unavailable',
      flags: MessageFlags.Ephemeral,
    })
  })

  it('runs the handler body when the gate is enabled', async () => {
    commandComponentEnabled.mockResolvedValueOnce(true)
    const handler = new FixtureHandler()
    const reply = vi.fn(async () => undefined)

    await handler.run(componentInteraction(reply))

    expect(handler.ran).toHaveBeenCalledOnce()
    expect(reply).not.toHaveBeenCalled()
  })
})
