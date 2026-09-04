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
  isNull,
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
  createGuildTagCommand,
  deleteGuildTagCommand,
  isCommandCapError,
  MAX_COMMAND_DESCRIPTION_LENGTH,
  promotionsCounter,
  reservedCommandNames,
  tagCommandName,
} from '../../utils/guildTagCommands.mjs'
import { replyWithRenderedTag } from '../../utils/tagRender.mjs'

const MAX_LISTED_TAGS = 100

// Tags are namespaced per guild, so the command needs one; registration
// below also hides it outside guilds.
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
      // % and _ are LIKE wildcards; a literal search must not let users match
      // through them.
      const pattern = `%${focused.replace(/[\\%_]/g, '\\$&')}%`
      const rows = await db
        .select({ name: tags.name })
        .from(tags)
        // Substring matches, plus trigram-similar names (the % operator) so
        // typos still surface suggestions. Both are backed by the pg_trgm
        // index; best match first.
        .where(
          and(
            eq(tags.guildId, BigInt(interaction.guildId)),
            or(ilike(tags.name, pattern), sql`${tags.name} % ${focused}`),
            // Demoting only makes sense for promoted tags.
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

    // Discord enforces minLength(1) on the raw option, but a whitespace-only
    // name still passes it and would land as an empty tag after trimming.
    if (!name) {
      return interaction.reply({
        content: (await resolveKey(
          interaction,
          'commands/tag:promoteInvalidName',
          { name: interaction.options.getString('name', true) },
        )) as string,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      })
    }

    // Subscription-controlled cap; see the registry in premium/limits.mts.
    // Serialize creates per guild inside Postgres so concurrent interactions
    // cannot both observe the last free slot and overshoot the cap.
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
    // Tag authors may edit their own tags; guild managers may edit any tag.
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

    // The guild command must not outlive its tag; reconciliation mops up
    // if this delete fails.
    if (tag.commandId !== null) {
      try {
        await deleteGuildTagCommand(
          interaction.client,
          interaction.guildId,
          tag.commandId,
        )
        promotionsCounter.add(1, { action: 'demote', trigger: 'tagDelete' })
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
        // Promoted tags read as the slash command they answer to.
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

    // Fit inside Discord's 2000-character message limit, fences included.
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

    const commandName = tagCommandName(tag.name, reservedCommandNames())
    if (!commandName.ok) {
      return interaction.reply({
        content: (await resolveKey(
          interaction,
          commandName.reason === 'reserved'
            ? 'commands/tag:promoteNameCollision'
            : 'commands/tag:promoteInvalidName',
          { name: tag.name },
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

    // Subscription-controlled cap; same per-guild serialization as tag
    // creation so concurrent promotions cannot overshoot it. Registering
    // with Discord inside the transaction means a REST failure rolls the
    // promotion back.
    const limit = await limitFor(interaction, 'tags.maxPromotedPerGuild')
    const argsDescription = (await resolveKey(
      interaction,
      'commands/descriptions:tagOptionArgs',
    )) as string
    try {
      const outcome = await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtextextended(${interaction.guildId}, 0))`,
        )
        if (Number.isFinite(limit)) {
          const [held] = await tx
            .select({ value: count() })
            .from(tags)
            .where(
              and(
                eq(tags.guildId, BigInt(interaction.guildId)),
                isNotNull(tags.commandId),
              ),
            )
          if ((held?.value ?? 0) >= limit) return 'limit' as const
        }

        // Re-select under the lock: a concurrent promote may have claimed
        // the tag after our pre-transaction read.
        const [fresh] = await tx
          .select({ id: tags.id })
          .from(tags)
          .where(and(eq(tags.id, tag.id), isNull(tags.commandId)))
        if (!fresh) return 'alreadyPromoted' as const

        const commandId = await createGuildTagCommand(
          interaction.client,
          interaction.guildId,
          commandName.name,
          description,
          argsDescription,
        )
        const updated = await tx
          .update(tags)
          .set({
            commandId,
            commandDescription: description,
            promotedBy: BigInt(interaction.user.id),
            promotedAt: new Date(),
          })
          .where(and(eq(tags.id, tag.id), isNull(tags.commandId)))
          .returning({ id: tags.id })
        if (updated.length === 0) return 'alreadyPromoted' as const
        return 'promoted' as const
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
    } catch (error) {
      if (!isCommandCapError(error)) {
        this.container.logger.warn(
          `Could not promote tag ${tag.name} in guild ${interaction.guildId}`,
          error,
        )
      }
      return interaction.reply({
        content: (await resolveKey(interaction, 'commands/tag:promoteFailed', {
          name: commandName.name,
          error: error instanceof Error ? error.message : String(error),
        })) as string,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      })
    }

    promotionsCounter.add(1, { action: 'promote', trigger: 'command' })
    return interaction.reply({
      content: (await resolveKey(interaction, 'commands/tag:promoted', {
        name: tag.name,
        command: commandName.name,
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
    let outcome: 'demoted' | 'notPromoted'
    try {
      outcome = await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtextextended(${interaction.guildId}, 0))`,
        )
        // Re-read under the lock: a concurrent demote may have cleared the
        // promotion, or a delete/recreate cycle may have replaced it.
        const [fresh] = await tx
          .select({ commandId: tags.commandId })
          .from(tags)
          .where(eq(tags.id, tag.id))
        if (!fresh || fresh.commandId === null) return 'notPromoted' as const
        if (fresh.commandId !== expectedCommandId) return 'notPromoted' as const

        // Discord first: if the delete fails the row stays promoted and the
        // command keeps working, which is the consistent state.
        await deleteGuildTagCommand(
          interaction.client,
          interaction.guildId,
          expectedCommandId,
        )
        // Conditional clear: only demote if the command id still matches
        // what we read, so an interleaved promote is never wiped.
        const cleared = await tx
          .update(tags)
          .set({
            commandId: null,
            commandDescription: null,
            promotedBy: null,
            promotedAt: null,
          })
          .where(
            and(eq(tags.id, tag.id), eq(tags.commandId, expectedCommandId)),
          )
          .returning({ id: tags.id })
        return cleared.length > 0
          ? ('demoted' as const)
          : ('notPromoted' as const)
      })
    } catch (error) {
      this.container.logger.warn(
        `Could not demote tag ${tag.name} in guild ${interaction.guildId}`,
        error,
      )
      return interaction.reply({
        content: (await resolveKey(interaction, 'commands/tag:promoteFailed', {
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

    promotionsCounter.add(1, { action: 'demote', trigger: 'command' })
    return interaction.reply({
      content: (await resolveKey(interaction, 'commands/tag:demoted', {
        name: tag.name,
        command: tag.name.toLowerCase(),
      })) as string,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    })
  }

  /** Registering a guild-wide slash command is guild administration, not an
   * authorship perk — tag ownership deliberately doesn't count here. */
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
      // pg_trgm "did you mean": the closest existing name in this guild, if
      // it's close enough to plausibly be a typo.
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
