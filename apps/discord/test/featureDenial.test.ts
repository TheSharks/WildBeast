import { EventEmitter } from 'node:events'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { container, ListenerStore } from '@sapphire/framework'
import { silentLogger } from '@thesharks/test-utils'
import { MessageFlags } from 'discord.js'
import { describe, expect, it, vi } from 'vitest'
import { FeaturePreconditionIdentifier } from '../src/preconditions/Feature.mjs'

vi.mock('@sapphire/plugin-i18next', async () => {
  const actual = await vi.importActual('@sapphire/plugin-i18next')
  return {
    ...actual,
    resolveKey: vi.fn(async (_interaction, key) => key),
  }
})

const { CommandDeniedReplyListener } = await import(
  '../src/listeners/reporting/commandDeniedReply.mjs'
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
})
