import {
  type ApplicationCommandRegistry,
  type Awaitable,
  type ChatInputCommand,
  Command,
  type ContextMenuCommand,
  container,
} from '@sapphire/framework'
import { Subcommand } from '@sapphire/plugin-subcommands'
import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  ContextMenuCommandBuilder,
  type ContextMenuCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js'
import type { ExperimentCompletion } from '../features/experiments.mjs'
import type { PremiumRequirement } from '../features/gates.mjs'
import { commandGateKey } from '../features/registry.mjs'
import type { OperatorCommandData } from '../operators/service.mjs'
import { installRegistrationDefaults } from '../runtime/registration.mjs'
import { WorkRejected } from '../runtime/work.mjs'
import {
  attributesFromInteraction,
  spanName,
  withInteractionSpan,
} from '../telemetry/spans.mjs'
import { replyFeatureUnavailable } from '../utils/replies.mjs'

type CommandInteraction =
  | ChatInputCommandInteraction
  | ContextMenuCommandInteraction

/**
 * `global` commands register through Sapphire (globally, or in the dev
 * guild). `operator` commands never enter a registry: their definition is
 * captured here and placed per guild by the operator command reconciler,
 * hidden behind admin-only default permissions and the owner check.
 */
export type CommandScope = 'global' | 'operator'

export interface ScopedCommand extends Command {
  readonly scope: CommandScope
  /** Captured definition for operator-scoped commands. */
  operatorCommand?: OperatorCommandData
}

/** A registry stand-in that records the built command instead of registering it. */
function captureOperatorCommand(
  command: ScopedCommand,
): ApplicationCommandRegistry {
  const capture = {
    registerChatInputCommand(input: unknown) {
      command.operatorCommand = build(input, () => new SlashCommandBuilder())
      return capture
    },
    registerContextMenuCommand(input: unknown) {
      command.operatorCommand = build(
        input,
        () => new ContextMenuCommandBuilder(),
      )
      return capture
    },
  }
  return capture as unknown as ApplicationCommandRegistry
}

function build(
  input: unknown,
  fresh: () => { toJSON(): unknown },
): OperatorCommandData {
  let value = input
  if (typeof input === 'function') {
    const builder = fresh()
    input(builder)
    value = builder
  }
  const data =
    value && typeof (value as { toJSON?: unknown }).toJSON === 'function'
      ? (value as { toJSON(): OperatorCommandData }).toJSON()
      : (value as OperatorCommandData)
  // Only admins see operator commands; the owner check decides who runs them.
  return { ...data, default_member_permissions: '0' }
}

/**
 * Registration, preconditions and gates. Shared by plain commands and
 * subcommand groups, which extend different Sapphire classes.
 */
function installCommandBehavior(
  command: ScopedCommand,
  premium?: PremiumRequirement,
): void {
  if (command.scope === 'operator') {
    const register = command.registerApplicationCommands?.bind(command)
    if (register) {
      command.registerApplicationCommands = async () =>
        register(captureOperatorCommand(command))
    }
    command.preconditions.append('OwnerOnly')
  } else
    installRegistrationDefaults(command, async () => {
      let hints: string[] = []
      try {
        hints = await container.app.commandIds.hintsFor(command.name)
      } catch (error) {
        // Registration survives DB outages; Sapphire falls back to name matching.
        container.logger.warn(
          `Could not load id hints for ${command.name}, continuing without`,
          error,
        )
      }
      return { hints, devGuildId: container.app.config.devGuildId }
    })
  const key = commandGateKey(command.name)
  if (key) command.preconditions.append({ name: 'Feature', context: { key } })
  if (premium)
    command.preconditions.append({ name: 'Premium', context: { ...premium } })
}

/**
 * Autocomplete has no preconditions, so admission, the owner check and the
 * gates run here before the command's `autocomplete` body.
 */
async function runAutocomplete(
  command: ScopedCommand,
  interaction: AutocompleteInteraction,
  autocomplete: ((interaction: AutocompleteInteraction) => unknown) | undefined,
): Promise<unknown> {
  // Sapphire only offers autocomplete to interaction handlers when the command
  // has no autocompleteRun; the base classes always have one, so pass it on.
  if (!autocomplete)
    return container.stores.get('interaction-handlers').run(interaction)
  try {
    return await container.app.work.run(async () => {
      if (
        command.scope === 'operator' &&
        !container.app.config.ownerIds.has(BigInt(interaction.user.id))
      )
        return interaction.respond([])
      const evaluation = await container.app.gates.evaluateInteraction(
        interaction,
        command.name,
      )
      return evaluation.flagEnabled && evaluation.premiumAllowed
        ? autocomplete(interaction)
        : interaction.respond([])
    })
  } catch (error) {
    if (error instanceof WorkRejected) return interaction.respond([])
    throw error
  }
}

/** Admits, traces and experiment-scopes one command run. */
async function runAdmitted<T>(
  command: Command,
  interaction: CommandInteraction,
  type: 'chat_input' | 'context_menu',
  operation: string,
  run: () => Promise<T>,
  completion: ExperimentCompletion = 'return',
): Promise<T | undefined> {
  try {
    return await container.app.work.run(() =>
      withInteractionSpan(
        spanName(`command.${command.name}`),
        interaction,
        {
          ...attributesFromInteraction(interaction, command),
          'discord.command.name': command.name,
          ...(interaction.isChatInputCommand()
            ? {
                'discord.command.subcommand':
                  interaction.options.getSubcommand(false) ?? undefined,
              }
            : {}),
          'discord.command.type': type,
          'sentry.op': 'discord.command',
        },
        () =>
          container.app.experiments.run(
            { kind: 'command', name: operation },
            run,
            completion,
          ),
      ),
    )
  } catch (error) {
    if (!(error instanceof WorkRejected)) throw error
    // The worker is stopping; answer instead of letting the interaction expire.
    await replyFeatureUnavailable(interaction)
    return undefined
  }
}

export interface AppCommandOptions extends Command.Options {
  premium?: PremiumRequirement
  scope?: CommandScope
}

/**
 * Base class for slash commands. Implement `chatInput` (and `contextMenu` or
 * `autocomplete` when the command has one) instead of Sapphire's
 * `chatInputRun`, `contextMenuRun` and `autocompleteRun`: this class owns
 * those entry points and admits, traces, experiment-scopes and gates every
 * run before calling yours.
 */
export abstract class AppCommand extends Command implements ScopedCommand {
  public readonly scope: CommandScope
  public operatorCommand?: OperatorCommandData
  private readonly premium: PremiumRequirement | undefined

  public constructor(
    context: Command.LoaderContext,
    options: AppCommandOptions,
  ) {
    super(context, options)
    this.scope = options.scope ?? 'global'
    this.premium = options.premium
    installCommandBehavior(this, options.premium)
  }

  /** The slash command body. */
  protected abstract chatInput(
    interaction: Command.ChatInputCommandInteraction,
    context: ChatInputCommand.RunContext,
  ): Awaitable<unknown>

  /** The context menu body, for commands that register one. */
  protected contextMenu?(
    interaction: Command.ContextMenuCommandInteraction,
    context: ContextMenuCommand.RunContext,
  ): Awaitable<unknown>

  /** The autocomplete body, for commands with autocompleted options. */
  protected autocomplete?(
    interaction: AutocompleteInteraction,
  ): Awaitable<unknown>

  public override onLoad() {
    // The gate registry is per runtime, so pieces register as they load.
    if (this.premium)
      container.app.gates.requirePremium(this.name, this.premium)
    return super.onLoad()
  }

  public override chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
    context: ChatInputCommand.RunContext,
  ) {
    return runAdmitted(this, interaction, 'chat_input', this.name, async () =>
      this.chatInput(interaction, context),
    )
  }

  public override contextMenuRun(
    interaction: Command.ContextMenuCommandInteraction,
    context: ContextMenuCommand.RunContext,
  ) {
    return runAdmitted(
      this,
      interaction,
      'context_menu',
      this.name,
      async () => {
        if (!this.contextMenu)
          throw new Error(`${this.name} does not implement contextMenu`)
        return this.contextMenu(interaction, context)
      },
    )
  }

  public override autocompleteRun(interaction: AutocompleteInteraction) {
    return runAutocomplete(this, interaction, this.autocomplete?.bind(this))
  }
}

export interface AppSubcommandOptions extends Subcommand.Options {
  premium?: PremiumRequirement
  scope?: CommandScope
}

/**
 * Base class for subcommand groups. The subcommands plugin already owns
 * `chatInputRun` and dispatches to the mapped methods; this class wraps that
 * dispatch the same way `AppCommand` wraps `chatInput`. Implement
 * `autocomplete` instead of Sapphire's `autocompleteRun`.
 */
export abstract class AppSubcommand
  extends Subcommand
  implements ScopedCommand
{
  public readonly scope: CommandScope
  public operatorCommand?: OperatorCommandData
  private readonly premium: PremiumRequirement | undefined

  public constructor(
    context: Subcommand.LoaderContext,
    options: AppSubcommandOptions,
  ) {
    super(context, options)
    this.scope = options.scope ?? 'global'
    this.premium = options.premium
    installCommandBehavior(this, options.premium)
  }

  /** The autocomplete body, for commands with autocompleted options. */
  protected autocomplete?(
    interaction: AutocompleteInteraction,
  ): Awaitable<unknown>

  public override onLoad() {
    // The gate registry is per runtime, so pieces register as they load.
    if (this.premium)
      container.app.gates.requirePremium(this.name, this.premium)
    return super.onLoad()
  }

  public override chatInputRun(
    interaction: Subcommand.ChatInputCommandInteraction,
    context: ChatInputCommand.RunContext,
  ) {
    return runAdmitted(
      this,
      interaction,
      'chat_input',
      [this.name, interaction.options.getSubcommand(false)]
        .filter(Boolean)
        .join('.'),
      () => super.chatInputRun(interaction, context),
      // The subcommands plugin converts mapped-method throws into events;
      // the success/error listeners complete the experiment scope.
      'event',
    )
  }

  public override autocompleteRun(interaction: AutocompleteInteraction) {
    return runAutocomplete(this, interaction, this.autocomplete?.bind(this))
  }
}
