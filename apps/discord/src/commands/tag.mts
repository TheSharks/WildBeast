import { ApplyOptions } from '@sapphire/decorators'
import type { Command } from '@sapphire/framework'
import { CommandOptionsRunTypeEnum } from '@sapphire/framework'
import { applyLocalizedBuilder, resolveKey } from '@sapphire/plugin-i18next'
import type { Subcommand } from '@sapphire/plugin-subcommands'
import {
  escapeCodeBlock,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  type SlashCommandStringOption,
} from 'discord.js'
import {
  subjectFromInteraction,
  tierForSubject,
} from '../premium/interaction.mjs'
import { upsellForLimit } from '../premium/upsell.mjs'
import { AppSubcommand } from '../structures/command.mjs'
import type { Tag } from '../tags/model.mjs'
import { replyWithRenderedTag } from '../tags/render.mjs'
import type { TagActor } from '../tags/service.mjs'
import { recordRepair } from '../telemetry/tag-metrics.mjs'

type Interaction = Subcommand.ChatInputCommandInteraction<'cached'>
const MAX_COMMAND_DESCRIPTION_LENGTH = 100

// Tags are guild-namespaced; registration hides the command outside guilds.
@ApplyOptions<Subcommand.Options>({
  runIn: [CommandOptionsRunTypeEnum.GuildAny],
  cooldownDelay: 3_000,
  subcommands: [
    { name: 'show', chatInputRun: 'chatInputShow' },
    { name: 'create', chatInputRun: 'chatInputCreate' },
    { name: 'edit', chatInputRun: 'chatInputEdit' },
    { name: 'delete', chatInputRun: 'chatInputDelete' },
    { name: 'list', chatInputRun: 'chatInputList' },
    { name: 'info', chatInputRun: 'chatInputInfo' },
    { name: 'raw', chatInputRun: 'chatInputRaw' },
    { name: 'promote', chatInputRun: 'chatInputPromote' },
    { name: 'demote', chatInputRun: 'chatInputDemote' },
  ],
})
export class TagCommand extends AppSubcommand {
  public override registerApplicationCommands(registry: Subcommand.Registry) {
    const nameOption = (
      option: SlashCommandStringOption,
      autocomplete = true,
    ) =>
      applyLocalizedBuilder(
        option,
        'commands/names:tagOptionName',
        'commands/descriptions:tagOptionName',
      )
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(32)
        .setAutocomplete(autocomplete)
    const contentOption = (option: SlashCommandStringOption) =>
      applyLocalizedBuilder(
        option,
        'commands/names:tagOptionContent',
        'commands/descriptions:tagOptionContent',
      ).setRequired(true)
    const sub = (name: string) =>
      [`commands/names:${name}`, `commands/descriptions:${name}`] as const

    registry.registerChatInputCommand((builder) => {
      applyLocalizedBuilder(builder, ...sub('tag'))
        .setContexts(InteractionContextType.Guild)
        .addSubcommand((s) =>
          applyLocalizedBuilder(s, ...sub('tagShow'))
            .addStringOption((option) => nameOption(option))
            .addStringOption((option) =>
              applyLocalizedBuilder(
                option,
                'commands/names:tagOptionArgs',
                'commands/descriptions:tagOptionArgs',
              ),
            ),
        )
        .addSubcommand((s) =>
          applyLocalizedBuilder(s, ...sub('tagCreate'))
            .addStringOption((option) => nameOption(option, false))
            .addStringOption(contentOption),
        )
        .addSubcommand((s) =>
          applyLocalizedBuilder(s, ...sub('tagEdit'))
            .addStringOption((option) => nameOption(option))
            .addStringOption(contentOption),
        )
        .addSubcommand((s) =>
          applyLocalizedBuilder(s, ...sub('tagDelete')).addStringOption(
            (option) => nameOption(option),
          ),
        )
        .addSubcommand((s) =>
          applyLocalizedBuilder(s, ...sub('tagList')).addUserOption((option) =>
            applyLocalizedBuilder(
              option,
              'commands/names:tagOptionAuthor',
              'commands/descriptions:tagOptionAuthor',
            ),
          ),
        )
        .addSubcommand((s) =>
          applyLocalizedBuilder(s, ...sub('tagInfo')).addStringOption(
            (option) => nameOption(option),
          ),
        )
        .addSubcommand((s) =>
          applyLocalizedBuilder(s, ...sub('tagRaw')).addStringOption((option) =>
            nameOption(option),
          ),
        )
        .addSubcommand((s) =>
          applyLocalizedBuilder(s, ...sub('tagPromote'))
            .addStringOption((option) => nameOption(option))
            .addStringOption((option) =>
              applyLocalizedBuilder(
                option,
                'commands/names:tagOptionDescription',
                'commands/descriptions:tagOptionDescription',
              ).setMaxLength(MAX_COMMAND_DESCRIPTION_LENGTH),
            ),
        )
        .addSubcommand((s) =>
          applyLocalizedBuilder(s, ...sub('tagDemote')).addStringOption(
            (option) => nameOption(option),
          ),
        )
    })
  }

  public override async autocompleteRun(
    interaction: Command.AutocompleteInteraction,
  ) {
    if (!interaction.guildId) return interaction.respond([])
    try {
      const names = await this.container.app.tags.search(
        BigInt(interaction.guildId),
        interaction.options.getFocused(),
        // Demote only applies to promoted tags.
        interaction.options.getSubcommand(false) === 'demote',
      )
      return interaction.respond(names.map((name) => ({ name, value: name })))
    } catch (error) {
      this.container.logger.warn('Could not autocomplete tag names', error)
      return interaction.respond([])
    }
  }

  public async chatInputShow(interaction: Interaction) {
    const tag = await this.findTag(interaction)
    if (!tag) return this.replyNotFound(interaction)
    return replyWithRenderedTag(interaction, tag.content)
  }

  public async chatInputCreate(interaction: Interaction) {
    const name = interaction.options.getString('name', true)
    const outcome = await this.container.app.tags.create(
      this.actor(interaction),
      name,
      interaction.options.getString('content', true),
    )
    switch (outcome.kind) {
      case 'invalidName':
        return this.reply(interaction, 'commands/tag:invalidName', { name })
      case 'limit':
        return interaction.reply({
          content: await this.text(interaction, 'commands/tag:limitReached', {
            limit: outcome.limit,
          }),
          components: this.upsell(interaction, 'tags.maxPerGuild'),
          flags: MessageFlags.Ephemeral,
        })
      case 'exists':
        return this.reply(interaction, 'commands/tag:alreadyExists', {
          name: name.trim(),
        })
      case 'created':
        return this.reply(interaction, 'commands/tag:created', {
          name: outcome.tag.name,
        })
    }
  }

  public async chatInputEdit(interaction: Interaction) {
    const outcome = await this.container.app.tags.edit(
      this.actor(interaction),
      interaction.options.getString('name', true),
      interaction.options.getString('content', true),
    )
    switch (outcome.kind) {
      case 'notFound':
        return this.replyNotFound(interaction)
      case 'forbidden':
        return this.reply(interaction, 'commands/tag:notOwner')
      case 'updated':
        return this.reply(interaction, 'commands/tag:updated', {
          name: outcome.tag.name,
        })
    }
  }

  public async chatInputDelete(interaction: Interaction) {
    const outcome = await this.container.app.tags.remove(
      this.actor(interaction),
      interaction.options.getString('name', true),
    )
    switch (outcome.kind) {
      case 'notFound':
        return this.replyNotFound(interaction)
      case 'forbidden':
        return this.reply(interaction, 'commands/tag:notOwner')
      case 'deleted':
        // The command must not outlive its tag; the repair is durable so a
        // failure here is retried by the scheduled reconciliation.
        if (outcome.tag.commandId !== null)
          void this.repair(interaction.guildId).catch(() => undefined)
        return this.reply(interaction, 'commands/tag:deleted', {
          name: outcome.tag.name,
        })
    }
  }

  public async chatInputList(interaction: Interaction) {
    const author = interaction.options.getUser('author')
    const rows = await this.container.app.tags.list(
      BigInt(interaction.guildId),
      author ? BigInt(author.id) : undefined,
    )
    if (rows.length === 0)
      return this.reply(interaction, 'commands/tag:listEmpty')
    return this.reply(interaction, 'commands/tag:list', {
      count: rows.length,
      // Promoted tags display as their slash command.
      names: rows
        .map((row) =>
          row.commandId !== null
            ? `\`/${row.name.toLowerCase()}\``
            : `\`${row.name}\``,
        )
        .join(', '),
    })
  }

  public async chatInputInfo(interaction: Interaction) {
    const tag = await this.findTag(interaction)
    if (!tag) return this.replyNotFound(interaction)
    const info = await this.text(interaction, 'commands/tag:info', {
      name: tag.name,
      authorId: tag.authorId.toString(),
      length: tag.content.length,
    })
    const promoted =
      tag.commandId !== null
        ? await this.text(interaction, 'commands/tag:infoPromoted', {
            name: tag.name.toLowerCase(),
            promotedBy: tag.promotedBy?.toString(),
          })
        : ''
    return interaction.reply({
      content: info + promoted,
      allowedMentions: { parse: [] },
    })
  }

  public async chatInputRaw(interaction: Interaction) {
    const tag = await this.findTag(interaction)
    if (!tag) return this.replyNotFound(interaction)
    // Stay inside Discord's 2000-char limit including fences.
    const content = escapeCodeBlock(tag.content).slice(0, 1_900)
    return interaction.reply({
      content: `\`\`\`\n${content}\n\`\`\``,
      flags: MessageFlags.Ephemeral,
    })
  }

  public async chatInputPromote(interaction: Interaction) {
    const actor = this.actor(interaction)
    if (!actor.canManageGuild)
      return this.reply(interaction, 'commands/tag:promoteMissingPermission')
    const tag = await this.findTag(interaction)
    if (!tag) return this.replyNotFound(interaction)
    const description =
      interaction.options.getString('description') ??
      (await this.text(interaction, 'commands/tag:defaultCommandDescription', {
        name: tag.name,
      }))
    const argsDescription = await this.text(
      interaction,
      'commands/descriptions:tagOptionArgs',
    )
    const command = tag.name.toLowerCase()
    const outcome = await this.container.app.tags.promote(
      actor,
      tag.name,
      description,
      argsDescription,
    )
    switch (outcome.kind) {
      case 'forbidden':
        return this.reply(interaction, 'commands/tag:promoteMissingPermission')
      case 'notFound':
        return this.replyNotFound(interaction)
      case 'invalidName':
        return this.reply(interaction, 'commands/tag:promoteInvalidName', {
          name: tag.name,
        })
      case 'reserved':
        return this.reply(interaction, 'commands/tag:promoteNameCollision', {
          name: tag.name,
        })
      case 'alreadyPromoted':
        return this.reply(interaction, 'commands/tag:alreadyPromoted', {
          name: tag.name,
        })
      case 'cleanupPending':
        return this.reply(interaction, 'commands/tag:promoteCleanupPending', {
          name: command,
        })
      case 'limit':
        return interaction.reply({
          content: await this.text(
            interaction,
            'commands/tag:promoteLimitReached',
            { limit: outcome.limit },
          ),
          components: this.upsell(interaction, 'tags.maxPromotedPerGuild'),
          flags: MessageFlags.Ephemeral,
        })
      case 'requested': {
        // Intent is durable; tell the user what Discord actually did.
        const error = await this.repairIntent(interaction.guildId, tag)
        if (error !== undefined) {
          return this.reply(interaction, 'commands/tag:promoteFailed', {
            name: command,
            error: error instanceof Error ? error.message : String(error),
          })
        }
        return this.reply(interaction, 'commands/tag:promoted', {
          name: tag.name,
          command,
        })
      }
    }
  }

  public async chatInputDemote(interaction: Interaction) {
    const actor = this.actor(interaction)
    if (!actor.canManageGuild)
      return this.reply(interaction, 'commands/tag:promoteMissingPermission')
    const tag = await this.findTag(interaction)
    if (!tag) return this.replyNotFound(interaction)
    const outcome = await this.container.app.tags.demote(actor, tag.name)
    const command = tag.name.toLowerCase()
    switch (outcome.kind) {
      case 'forbidden':
        return this.reply(interaction, 'commands/tag:promoteMissingPermission')
      case 'notFound':
        return this.replyNotFound(interaction)
      case 'notPromoted':
        return this.reply(interaction, 'commands/tag:notPromoted', {
          name: tag.name,
        })
      case 'requested': {
        const error = await this.repairIntent(interaction.guildId, tag)
        if (error !== undefined) {
          return this.reply(interaction, 'commands/tag:demoteFailed', {
            name: command,
            error: error instanceof Error ? error.message : String(error),
          })
        }
        return this.reply(interaction, 'commands/tag:demoted', {
          name: tag.name,
          command,
        })
      }
    }
  }

  private actor(interaction: Interaction): TagActor {
    const subject = subjectFromInteraction(interaction)
    return {
      guildId: BigInt(interaction.guildId),
      userId: subject.userId,
      // Promoting is guild administration, not an authorship perk.
      canManageGuild:
        interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ??
        false,
      grants: subject.grants,
    }
  }

  private findTag(interaction: Interaction) {
    return this.container.app.tags.find(
      BigInt(interaction.guildId),
      interaction.options.getString('name', true),
    )
  }

  private async repair(guildId: string) {
    const result = await this.container.app.tagReconciler.reconcileGuild(
      BigInt(guildId),
      this.container.app.work.signal,
    )
    recordRepair(result, 'command')
    return result
  }

  /** Run the repair now and surface the failure for this tag's intent, if any. */
  private async repairIntent(guildId: string, tag: Tag): Promise<unknown> {
    try {
      const result = await this.repair(guildId)
      const intents = await this.container.app.tags.intentsFor(BigInt(guildId))
      const own = intents.find(
        (intent) =>
          intent.tagId === tag.id || intent.name === tag.name.toLowerCase(),
      )
      const failure = result.failures.find(
        (candidate) => candidate.intentId === own?.id,
      )
      return failure?.error
    } catch (error) {
      this.container.logger.warn(
        `Could not repair tag commands for guild ${guildId}`,
        error,
      )
      return error
    }
  }

  private upsell(
    interaction: Interaction,
    key: 'tags.maxPerGuild' | 'tags.maxPromotedPerGuild',
  ) {
    const subject = subjectFromInteraction(interaction)
    return upsellForLimit(
      this.container.app.config.premiumCatalog,
      key,
      tierForSubject(this.container.app.premium, subject, 'guild'),
      subject.guildId,
    )
  }

  private async text(
    interaction: Interaction,
    key: string,
    values?: Record<string, unknown>,
  ): Promise<string> {
    return (await resolveKey(interaction, key, values)) as string
  }

  private async reply(
    interaction: Interaction,
    key: string,
    values?: Record<string, unknown>,
  ) {
    return interaction.reply({
      content: await this.text(interaction, key, values),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    })
  }

  private async replyNotFound(interaction: Interaction) {
    const name = interaction.options.getString('name', true)
    const app = this.container.app
    const variant = await app.experiments.variant(
      'experiments.tags.notFoundReply',
      app.gates.flagContext(subjectFromInteraction(interaction), {
        command: this.name,
        subcommand: interaction.options.getSubcommand(false) ?? undefined,
      }),
    )
    const suggestion =
      variant === 'suggestion'
        ? await app.tags.suggest(BigInt(interaction.guildId), name)
        : undefined
    return this.reply(
      interaction,
      suggestion ? 'commands/tag:notFoundSuggestion' : 'commands/tag:notFound',
      { name, suggestion },
    )
  }
}
