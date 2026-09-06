import {
  type ApplicationCommandRegistry,
  Command,
  container,
} from '@sapphire/framework'
import { resolveKey } from '@sapphire/plugin-i18next'
import { Subcommand } from '@sapphire/plugin-subcommands'
import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  ContextMenuCommandBuilder,
  type ContextMenuCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js'
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
 * Every command invocation is admitted through the runtime, traced, scoped
 * for experiments and gated. Shared by plain commands and subcommand groups.
 */
export function installCommandBehavior(
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
  if (premium) {
    command.preconditions.append({ name: 'Premium', context: { ...premium } })
    // The gate registry is per runtime; pieces register on first construction.
    const registerPremium = () =>
      container.app.gates.requirePremium(command.name, premium)
    command.onLoad = ((onLoad) => () => {
      registerPremium()
      return onLoad()
    })(command.onLoad.bind(command))
  }

  const autocompleteRun = command.autocompleteRun?.bind(command)
  if (autocompleteRun) {
    command.autocompleteRun = async (interaction: AutocompleteInteraction) => {
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
            ? autocompleteRun(interaction)
            : interaction.respond([])
        })
      } catch (error) {
        if (error instanceof WorkRejected) return interaction.respond([])
        throw error
      }
    }
  }
}

export async function runAdmitted<T>(
  command: Command,
  interaction: CommandInteraction,
  type: 'chat_input' | 'context_menu',
  operation: string,
  run: () => Promise<T>,
  options: { automatic?: boolean } = {},
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
            options,
          ),
      ),
    )
  } catch (error) {
    if (!(error instanceof WorkRejected)) throw error
    // The worker is stopping; answer instead of letting the interaction expire.
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: (await resolveKey(
          interaction,
          'system/errors:feature_unavailable',
        )) as string,
        flags: MessageFlags.Ephemeral,
      })
    }
    return undefined
  }
}

export interface AppCommandOptions extends Command.Options {
  premium?: PremiumRequirement
  scope?: CommandScope
}

export abstract class AppCommand extends Command implements ScopedCommand {
  public readonly scope: CommandScope
  public operatorCommand?: OperatorCommandData

  public constructor(
    context: Command.LoaderContext,
    options: AppCommandOptions,
  ) {
    super(context, options)
    this.scope = options.scope ?? 'global'
    installCommandBehavior(this, options.premium)
    const chatInputRun = this.chatInputRun?.bind(this)
    if (chatInputRun) {
      this.chatInputRun = (interaction, runContext) =>
        runAdmitted(this, interaction, 'chat_input', this.name, () =>
          Promise.resolve(chatInputRun(interaction, runContext)),
        )
    }
    const contextMenuRun = this.contextMenuRun?.bind(this)
    if (contextMenuRun) {
      this.contextMenuRun = (interaction, runContext) =>
        runAdmitted(this, interaction, 'context_menu', this.name, () =>
          Promise.resolve(contextMenuRun(interaction, runContext)),
        )
    }
  }
}

export interface AppSubcommandOptions extends Subcommand.Options {
  premium?: PremiumRequirement
  scope?: CommandScope
}

export abstract class AppSubcommand
  extends Subcommand
  implements ScopedCommand
{
  public readonly scope: CommandScope
  public operatorCommand?: OperatorCommandData

  public constructor(
    context: Subcommand.LoaderContext,
    options: AppSubcommandOptions,
  ) {
    super(context, options)
    this.scope = options.scope ?? 'global'
    installCommandBehavior(this, options.premium)
    const chatInputRun = this.chatInputRun?.bind(this)
    if (chatInputRun) {
      this.chatInputRun = (interaction, runContext) =>
        runAdmitted(
          this,
          interaction,
          'chat_input',
          [this.name, interaction.options.getSubcommand(false)]
            .filter(Boolean)
            .join('.'),
          () => Promise.resolve(chatInputRun(interaction, runContext)),
          // The subcommands plugin converts mapped-method throws into events;
          // the success/error listeners complete the experiment scope.
          { automatic: false },
        )
    }
  }
}
