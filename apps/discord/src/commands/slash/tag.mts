import { ApplyOptions } from '@sapphire/decorators'
import type { Command } from '@sapphire/framework'
import { CommandOptionsRunTypeEnum } from '@sapphire/framework'
import { applyLocalizedBuilder, resolveKey } from '@sapphire/plugin-i18next'
import type { Subcommand } from '@sapphire/plugin-subcommands'
import {
  and,
  asc,
  count,
  db,
  eq,
  ilike,
  isNotNull,
  or,
  sql,
  tags,
} from '@thesharks/drizzle'
import {
  escapeCodeBlock,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  type SlashCommandStringOption,
} from 'discord.js'
import { commandFlagContext } from '../../features/commandContext.mjs'
import { experimentVariant } from '../../features/experiments.mjs'
import { limitFor } from '../../premium/entitlements.mjs'
import { upsellForLimit } from '../../premium/upsell.mjs'
import { TracedSubcommand } from '../../structures/subcommand.mjs'
import {
  isCommandCapError,
  MAX_COMMAND_DESCRIPTION_LENGTH,
} from '../../utils/guildTagCommands.mjs'
import { replyWithRenderedTag } from '../../utils/tagRender.mjs'
import { type DemoteOutcome, TagCommands } from '../../utils/tagService.mjs'

const MAX_LISTED_TAGS = 100

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
export class TagCommand extends TracedSubcommand {
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

    registry.registerChatInputCommand((builder) => {
      applyLocalizedBuilder(
        builder,
        'commands/names:tag',
        'commands/descriptions:tag',
      )
        .setContexts(InteractionContextType.Guild)
        .addSubcommand((sub) =>
          applyLocalizedBuilder(
            sub,
            'commands/names:tagShow',
            'commands/descriptions:tagShow',
          )
            .addStringOption((option) => nameOption(option))
            .addStringOption((option) =>
              applyLocalizedBuilder(
                option,
                'commands/names:tagOptionArgs',
                'commands/descriptions:tagOptionArgs',
              ),
            ),
        )
        .addSubcommand((sub) =>
          applyLocalizedBuilder(
            sub,
            'commands/names:tagCreate',
            'commands/descriptions:tagCreate',
          )
            .addStringOption((option) => nameOption(option, false))
            .addStringOption((option) =>
              applyLocalizedBuilder(
                option,
                'commands/names:tagOptionContent',
                'commands/descriptions:tagOptionContent',
              ).setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          applyLocalizedBuilder(
            sub,
            'commands/names:tagEdit',
            'commands/descriptions:tagEdit',
          )
            .addStringOption((option) => nameOption(option))
            .addStringOption((option) =>
              applyLocalizedBuilder(
                option,
                'commands/names:tagOptionContent',
                'commands/descriptions:tagOptionContent',
              ).setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          applyLocalizedBuilder(
            sub,
            'commands/names:tagDelete',
            'commands/descriptions:tagDelete',
          ).addStringOption((option) => nameOption(option)),
        )
        .addSubcommand((sub) =>
          applyLocalizedBuilder(
            sub,
            'commands/names:tagList',
            'commands/descriptions:tagList',
          ).addUserOption((option) =>
            applyLocalizedBuilder(
              option,
              'commands/names:tagOptionAuthor',
              'commands/descriptions:tagOptionAuthor',
            ),
          ),
        )
        .addSubcommand((sub) =>
          applyLocalizedBuilder(
            sub,
            'commands/names:tagInfo',
            'commands/descriptions:tagInfo',
          ).addStringOption((option) => nameOption(option)),
        )
        .addSubcommand((sub) =>
          applyLocalizedBuilder(
            sub,
            'commands/names:tagRaw',
            'commands/descriptions:tagRaw',
          ).addStringOption((option) => nameOption(option)),
        )
        .addSubcommand((sub) =>
          applyLocalizedBuilder(
            sub,
            'commands/names:tagPromote',
            'commands/descriptions:tagPromote',
          )
            .addStringOption((option) => nameOption(option))
            .addStringOption((option) =>
              applyLocalizedBuilder(
                option,
                'commands/names:tagOptionDescription',
                'commands/descriptions:tagOptionDescription',
              ).setMaxLength(MAX_COMMAND_DESCRIPTION_LENGTH),
            ),
        )
        .addSubcommand((sub) =>
          applyLocalizedBuilder(
            sub,
            'commands/names:tagDemote',
            'commands/descriptions:tagDemote',
          ).addStringOption((option) => nameOption(option)),
        )
    })
  }

  public override async autocompleteRun(
    interaction: Command.AutocompleteInteraction,
  ) {
    if (!interaction.guildId) return interaction.respond([])
    try {
      const focused = interaction.options.getFocused()
      // Escape LIKE wildcards so search stays literal.
      const pattern = `%${focused.replace(/[\\%_]/g, '\\$&')}%`
      const rows = await db
        .select({ name: tags.name })
        .from(tags)
        // Substring plus trigram-similar matches for typos; best first.
        .where(
          and(
            eq(tags.guildId, BigInt(interaction.guildId)),
            or(ilike(tags.name, pattern), sql`${tags.name} % ${focused}`),
            // Demote only applies to promoted tags.
            interaction.options.getSubcommand(false) === 'demote'
              ? isNotNull(tags.commandId)
              : undefined,
          ),
        )
        .orderBy(sql`similarity(${tags.name}, ${focused}) DESC`, asc(tags.name))
        .limit(25)

      return interaction.respond(
        rows.map((row) => ({ name: row.name, value: row.name })),
      )
    } catch (error) {
      this.container.logger.warn('Could not autocomplete tag names', error)
      return interaction.respond([])
    }
  }

  public async chatInputShow(
    interaction: Subcommand.ChatInputCommandInteraction<'cached'>,
  ) {
    const tag = await this.findTag(interaction)
    if (!tag) {
      return this.replyNotFound(interaction)
    }

    return replyWithRenderedTag(interaction, tag.content)
  }

  public async chatInputCreate(
    interaction: Subcommand.ChatInputCommandInteraction<'cached'>,
  ) {
    const name = interaction.options.getString('name', true).trim()
    const content = interaction.options.getString('content', true)

    // Trimmed-empty names still pass minLength(1); reject them here.
    if (!name) {
      // Whitespace-only is a create-input error, not a promote-name error.
      return interaction.reply({
        content: (await resolveKey(interaction, 'commands/tag:invalidName', {
          name: interaction.options.getString('name', true),
        })) as string,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      })
    }

    // Cap from the limit registry; per-guild lock stops concurrent creates overshooting it.
    const limit = await limitFor(interaction, 'tags.maxPerGuild')
    const outcome = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${interaction.guildId}, 0))`,
      )
      if (Number.isFinite(limit)) {
        const [held] = await tx
          .select({ value: count() })
          .from(tags)
          .where(eq(tags.guildId, BigInt(interaction.guildId)))
        if ((held?.value ?? 0) >= limit) return 'limit' as const
      }

      const inserted = await tx
        .insert(tags)
        .values({
          guildId: BigInt(interaction.guildId),
          name,
          content,
          authorId: BigInt(interaction.user.id),
        })
        .onConflictDoNothing({ target: [tags.guildId, tags.name] })
        .returning({ name: tags.name })
      return inserted.length > 0 ? ('created' as const) : ('exists' as const)
    })

    if (outcome === 'limit') {
      return interaction.reply({
        content: (await resolveKey(interaction, 'commands/tag:limitReached', {
          limit,
        })) as string,
        components: upsellForLimit(interaction, 'tags.maxPerGuild'),
        flags: MessageFlags.Ephemeral,
      })
    }

    return interaction.reply({
      content: (await resolveKey(
        interaction,
        outcome === 'created'
          ? 'commands/tag:created'
          : 'commands/tag:alreadyExists',
        { name },
      )) as string,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    })
  }

  public async chatInputEdit(
    interaction: Subcommand.ChatInputCommandInteraction<'cached'>,
  ) {
    const tag = await this.findTag(interaction)
    if (!tag) {
      return this.replyNotFound(interaction)
    }
    // Authors edit own tags; managers edit any.
    if (
      tag.authorId !== BigInt(interaction.user.id) &&
      !this.canManageTagCommands(interaction)
    ) {
      return this.replyNotOwner(interaction)
    }

    await db
      .update(tags)
      .set({ content: interaction.options.getString('content', true) })
      .where(eq(tags.id, tag.id))

    return interaction.reply({
      content: (await resolveKey(interaction, 'commands/tag:updated', {
        name: tag.name,
      })) as string,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    })
  }

  public async chatInputDelete(
    interaction: Subcommand.ChatInputCommandInteraction<'cached'>,
  ) {
    const tag = await this.findTag(interaction)
    if (!tag) {
      return this.replyNotFound(interaction)
    }
    if (
      tag.authorId !== BigInt(interaction.user.id) &&
      !this.canManageTagCommands(interaction)
    ) {
      return this.replyNotOwner(interaction)
    }

    await db.delete(tags).where(eq(tags.id, tag.id))

    // Command must not outlive its tag; reconciliation mops up failures.
    if (tag.commandId !== null) {
      try {
        // Single REST+metric owner; already-gone counts as success.
        await TagCommands.deleteCommand(
          interaction.client,
          interaction.guildId,
          tag.commandId,
          'tagDelete',
        )
      } catch (error) {
        this.container.logger.warn(
          `Could not delete the guild command of deleted tag ${tag.name}`,
          error,
        )
      }
    }

    return interaction.reply({
      content: (await resolveKey(interaction, 'commands/tag:deleted', {
        name: tag.name,
      })) as string,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    })
  }

  public async chatInputList(
    interaction: Subcommand.ChatInputCommandInteraction<'cached'>,
  ) {
    const author = interaction.options.getUser('author')
    const rows = await db
      .select({ name: tags.name, commandId: tags.commandId })
      .from(tags)
      .where(
        and(
          eq(tags.guildId, BigInt(interaction.guildId)),
          author ? eq(tags.authorId, BigInt(author.id)) : undefined,
        ),
      )
      .orderBy(asc(tags.name))
      .limit(MAX_LISTED_TAGS)

    if (rows.length === 0) {
      return interaction.reply({
        content: (await resolveKey(
          interaction,
          'commands/tag:listEmpty',
        )) as string,
        flags: MessageFlags.Ephemeral,
      })
    }

    return interaction.reply({
      content: (await resolveKey(interaction, 'commands/tag:list', {
        count: rows.length,
        // Promoted tags display as their slash command.
        names: rows
          .map((row) =>
            row.commandId !== null
              ? `\`/${row.name.toLowerCase()}\``
              : `\`${row.name}\``,
          )
          .join(', '),
      })) as string,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    })
  }

  public async chatInputInfo(
    interaction: Subcommand.ChatInputCommandInteraction<'cached'>,
  ) {
    const tag = await this.findTag(interaction)
    if (!tag) {
      return this.replyNotFound(interaction)
    }

    const info = (await resolveKey(interaction, 'commands/tag:info', {
      name: tag.name,
      authorId: tag.authorId.toString(),
      length: tag.content.length,
    })) as string
    const promoted =
      tag.commandId !== null
        ? ((await resolveKey(interaction, 'commands/tag:infoPromoted', {
            name: tag.name.toLowerCase(),
            promotedBy: tag.promotedBy?.toString(),
          })) as string)
        : ''

    return interaction.reply({
      content: info + promoted,
      allowedMentions: { parse: [] },
    })
  }

  public async chatInputRaw(
    interaction: Subcommand.ChatInputCommandInteraction<'cached'>,
  ) {
    const tag = await this.findTag(interaction)
    if (!tag) {
      return this.replyNotFound(interaction)
    }

    // Stay inside Discord's 2000-char limit including fences.
    const content = escapeCodeBlock(tag.content).slice(0, 1_900)
    return interaction.reply({
      content: `\`\`\`\n${content}\n\`\`\``,
      flags: MessageFlags.Ephemeral,
    })
  }

  public async chatInputPromote(
    interaction: Subcommand.ChatInputCommandInteraction<'cached'>,
  ) {
    if (!this.canManageTagCommands(interaction)) {
      return this.replyMissingPermission(interaction)
    }

    const tag = await this.findTag(interaction)
    if (!tag) {
      return this.replyNotFound(interaction)
    }
    if (tag.commandId !== null) {
      return interaction.reply({
        content: (await resolveKey(
          interaction,
          'commands/tag:alreadyPromoted',
          {
            name: tag.name,
          },
        )) as string,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      })
    }

    const description =
      interaction.options.getString('description') ??
      ((await resolveKey(
        interaction,
        'commands/tag:defaultCommandDescription',
        { name: tag.name },
      )) as string)

    // Cap resolved here; enforcement plus name validation live in the service.
    const limit = await limitFor(interaction, 'tags.maxPromotedPerGuild')
    const argsDescription = (await resolveKey(
      interaction,
      'commands/descriptions:tagOptionArgs',
    )) as string
    let outcome: Awaited<ReturnType<typeof TagCommands.promote>>
    // Service lowercases valid names; mirrors its normalization for replies.
    const commandName = tag.name.toLowerCase()
    try {
      // Thin delegate; lock/tx/REST ordering owned by the service.
      outcome = await TagCommands.promote(interaction.client, {
        guildId: interaction.guildId,
        tagId: tag.id,
        tagName: tag.name,
        userId: interaction.user.id,
        description,
        argsDescription,
        limit,
      })

      if (outcome === 'limit') {
        return interaction.reply({
          content: (await resolveKey(
            interaction,
            'commands/tag:promoteLimitReached',
            { limit },
          )) as string,
          components: upsellForLimit(interaction, 'tags.maxPromotedPerGuild'),
          flags: MessageFlags.Ephemeral,
        })
      }
      if (outcome === 'alreadyPromoted') {
        return interaction.reply({
          content: (await resolveKey(
            interaction,
            'commands/tag:alreadyPromoted',
            { name: tag.name },
          )) as string,
          flags: MessageFlags.Ephemeral,
          allowedMentions: { parse: [] },
        })
      }
      if (outcome === 'invalidName' || outcome === 'reserved') {
        return interaction.reply({
          content: (await resolveKey(
            interaction,
            outcome === 'reserved'
              ? 'commands/tag:promoteNameCollision'
              : 'commands/tag:promoteInvalidName',
            { name: tag.name },
          )) as string,
          flags: MessageFlags.Ephemeral,
          allowedMentions: { parse: [] },
        })
      }
    } catch (error) {
      if (!isCommandCapError(error)) {
        this.container.logger.warn(
          `Could not promote tag ${tag.name} in guild ${interaction.guildId}`,
          error,
        )
      }
      return interaction.reply({
        content: (await resolveKey(interaction, 'commands/tag:promoteFailed', {
          name: commandName,
          error: error instanceof Error ? error.message : String(error),
        })) as string,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      })
    }

    return interaction.reply({
      content: (await resolveKey(interaction, 'commands/tag:promoted', {
        name: tag.name,
        command: commandName,
      })) as string,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    })
  }

  public async chatInputDemote(
    interaction: Subcommand.ChatInputCommandInteraction<'cached'>,
  ) {
    if (!this.canManageTagCommands(interaction)) {
      return this.replyMissingPermission(interaction)
    }

    const tag = await this.findTag(interaction)
    if (!tag) {
      return this.replyNotFound(interaction)
    }
    if (tag.commandId === null) {
      return interaction.reply({
        content: (await resolveKey(interaction, 'commands/tag:notPromoted', {
          name: tag.name,
        })) as string,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      })
    }

    const expectedCommandId = tag.commandId
    let outcome: DemoteOutcome
    try {
      // Thin delegate; re-read, Discord-first delete, and conditional clear owned by the service.
      outcome = await TagCommands.demote(interaction.client, {
        guildId: interaction.guildId,
        tagId: tag.id,
        expectedCommandId,
      })
    } catch (error) {
      this.container.logger.warn(
        `Could not demote tag ${tag.name} in guild ${interaction.guildId}`,
        error,
      )
      // Demote failures need their own copy; promoteFailed misleads about direction.
      return interaction.reply({
        content: (await resolveKey(interaction, 'commands/tag:demoteFailed', {
          name: tag.name.toLowerCase(),
          error: error instanceof Error ? error.message : String(error),
        })) as string,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      })
    }

    if (outcome === 'notPromoted') {
      return interaction.reply({
        content: (await resolveKey(interaction, 'commands/tag:notPromoted', {
          name: tag.name,
        })) as string,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      })
    }

    return interaction.reply({
      content: (await resolveKey(interaction, 'commands/tag:demoted', {
        name: tag.name,
        command: tag.name.toLowerCase(),
      })) as string,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    })
  }

  // Promoting is guild administration, not an authorship perk.
  private canManageTagCommands(
    interaction: Subcommand.ChatInputCommandInteraction<'cached'>,
  ): boolean {
    return (
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ??
      false
    )
  }

  private async replyMissingPermission(
    interaction: Subcommand.ChatInputCommandInteraction<'cached'>,
  ) {
    return interaction.reply({
      content: (await resolveKey(
        interaction,
        'commands/tag:promoteMissingPermission',
      )) as string,
      flags: MessageFlags.Ephemeral,
    })
  }

  private findTag(
    interaction: Subcommand.ChatInputCommandInteraction<'cached'>,
  ) {
    return db.query.tags.findFirst({
      where: and(
        eq(tags.guildId, BigInt(interaction.guildId)),
        eq(tags.name, interaction.options.getString('name', true).trim()),
      ),
    })
  }

  private async replyNotFound(
    interaction: Subcommand.ChatInputCommandInteraction<'cached'>,
  ) {
    const name = interaction.options.getString('name', true)
    const replyVariant = await experimentVariant(
      'experiments.tags.notFoundReply',
      commandFlagContext(interaction, this.name),
    )

    let closest: { name: string } | undefined
    if (replyVariant === 'suggestion') {
      // Closest name in guild when plausibly a typo.
      const matches = await db
        .select({ name: tags.name })
        .from(tags)
        .where(
          and(
            eq(tags.guildId, BigInt(interaction.guildId)),
            sql`similarity(${tags.name}, ${name}) > 0.3`,
          ),
        )
        .orderBy(sql`similarity(${tags.name}, ${name}) DESC`)
        .limit(1)
      closest = matches[0]
    }

    return interaction.reply({
      content: (await resolveKey(
        interaction,
        closest ? 'commands/tag:notFoundSuggestion' : 'commands/tag:notFound',
        { name, suggestion: closest?.name },
      )) as string,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    })
  }

  private async replyNotOwner(
    interaction: Subcommand.ChatInputCommandInteraction<'cached'>,
  ) {
    return interaction.reply({
      content: (await resolveKey(
        interaction,
        'commands/tag:notOwner',
      )) as string,
      flags: MessageFlags.Ephemeral,
    })
  }
}
