import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import * as Sentry from '@sentry/node'
import { metrics } from '@thesharks/analytics'
import type { ClientEvents } from 'discord.js'

const meter = metrics.getMeter('@thesharks/discord')
const frameworkErrorCounter = meter.createCounter('framework_errors_total', {
  description:
    'Errors surfaced by the Sapphire framework outside command execution',
})

function report(
  listener: Listener,
  source: string,
  piece: string,
  error: unknown,
): void {
  // Never throw here to avoid listenerError recursion.
  try {
    frameworkErrorCounter.add(1, { source, piece })
    listener.container.logger.error(`${source} error in ${piece}:`, error)
    Sentry.withScope((scope) => {
      scope.setTag('framework.source', source)
      scope.setTag('framework.piece', piece)
      Sentry.captureException(error)
    })
  } catch {
    // swallow: reporting must not become its own failure loop
  }
}

// Explicit names prevent same-file listeners unloading each other.
@ApplyOptions<ListenerOptions>({
  name: 'listenerErrorReporting',
  event: Events.ListenerError,
})
export class ListenerErrorListener extends Listener {
  public run(...[error, payload]: ClientEvents['listenerError']): void {
    report(this, 'listener', payload.piece.name, error)
  }
}

@ApplyOptions<ListenerOptions>({
  name: 'registryErrorReporting',
  event: Events.CommandApplicationCommandRegistryError,
})
export class RegistryErrorListener extends Listener {
  public run(
    ...[error, command]: ClientEvents['commandApplicationCommandRegistryError']
  ): void {
    report(this, 'command_registry', command.name, error)
  }
}

@ApplyOptions<ListenerOptions>({
  name: 'interactionHandlerErrorReporting',
  event: Events.InteractionHandlerError,
})
export class InteractionHandlerErrorListener extends Listener {
  public run(
    ...[error, payload]: ClientEvents['interactionHandlerError']
  ): void {
    report(this, 'interaction_handler', payload.handler.name, error)
  }
}

@ApplyOptions<ListenerOptions>({
  name: 'interactionHandlerParseErrorReporting',
  event: Events.InteractionHandlerParseError,
})
export class InteractionHandlerParseErrorListener extends Listener {
  public run(
    ...[error, payload]: ClientEvents['interactionHandlerParseError']
  ): void {
    report(this, 'interaction_handler_parse', payload.handler.name, error)
  }
}
