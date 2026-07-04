import { ApplyOptions } from '@sapphire/decorators'
import type { Command } from '@sapphire/framework'
import { applyLocalizedBuilder, resolveKey } from '@sapphire/plugin-i18next'
import type { Subcommand } from '@sapphire/plugin-subcommands'
import { asc, db, eq, ilike, or, sql, tags } from '@thesharks/drizzle'
import { RenderError, render } from '@thesharks/tagscript'
import {
  escapeCodeBlock,
  MessageFlags,
  type SlashCommandStringOption,
} from 'discord.js'
import { TracedSubcommand } from '../../structures/subcommand.mjs'

const MAX_LISTED_TAGS = 100

@ApplyOptions<Subcommand.Options>({
  subcommands: [
    { name: 'show', chatInputRun: 'chatInputShow' },
    { name: 'create', chatInputRun: 'chatInputCreate' },
    { name: 'edit', chatInputRun: 'chatInputEdit' },
    { name: 'delete', chatInputRun: 'chatInputDelete' },
    { name: 'list', chatInputRun: 'chatInputList' },
    { name: 'info', chatInputRun: 'chatInputInfo' },
    { name: 'raw', chatInputRun: 'chatInputRaw' },
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
        .setMaxLength(32)
        .setAutocomplete(autocomplete)

    registry.registerChatInputCommand((builder) => {
      applyLocalizedBuilder(
        builder,
        'commands/names:tag',
        'commands/descriptions:tag',
      )
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
    })
  }

  public override async autocompleteRun(
    interaction: Command.AutocompleteInteraction,
  ) {
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
      .where(or(ilike(tags.name, pattern), sql`${tags.name} % ${focused}`))
      .orderBy(sql`similarity(${tags.name}, ${focused}) DESC`, asc(tags.name))
      .limit(25)

    return interaction.respond(
      rows.map((row) => ({ name: row.name, value: row.name })),
    )
  }

  public async chatInputShow(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    const tag = await this.findTag(interaction.options.getString('name', true))
    if (!tag) {
      return this.replyNotFound(interaction)
    }

    let output: string
    try {
      const result = await render(tag.content, {
        maxOutputLength: 2000,
        args:
          interaction.options.getString('args')?.split(/\s+/).filter(Boolean) ??
          [],
        discord: {
          user: {
            id: interaction.user.id,
            tag: interaction.user.tag,
            mention: interaction.user.toString(),
          },
          channelId: interaction.channelId,
          serverId: interaction.guildId ?? undefined,
          server: interaction.guild?.name,
        },
      })
      output = result.output.trim()
    } catch (error) {
      if (error instanceof RenderError) {
        return interaction.reply({
          content: (await resolveKey(interaction, 'commands/tag:renderFailed', {
            error: error.message,
          })) as string,
          flags: MessageFlags.Ephemeral,
        })
      }
      throw error
    }

    if (!output) {
      return interaction.reply({
        content: (await resolveKey(
          interaction,
          'commands/tag:emptyOutput',
        )) as string,
        flags: MessageFlags.Ephemeral,
      })
    }

    return interaction.reply({
      content: output,
      // Tag content is user-authored: never let it ping anyone.
      allowedMentions: { parse: [] },
    })
  }

  public async chatInputCreate(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    const name = interaction.options.getString('name', true).trim()
    const content = interaction.options.getString('content', true)

    const inserted = await db
      .insert(tags)
      .values({
        name,
        content,
        authorId: BigInt(interaction.user.id),
      })
      .onConflictDoNothing({ target: tags.name })
      .returning({ name: tags.name })

    return interaction.reply({
      content: (await resolveKey(
        interaction,
        inserted.length > 0
          ? 'commands/tag:created'
          : 'commands/tag:alreadyExists',
        { name },
      )) as string,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    })
  }

  public async chatInputEdit(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    const tag = await this.findTag(interaction.options.getString('name', true))
    if (!tag) {
      return this.replyNotFound(interaction)
    }
    if (tag.authorId !== BigInt(interaction.user.id)) {
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
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    const tag = await this.findTag(interaction.options.getString('name', true))
    if (!tag) {
      return this.replyNotFound(interaction)
    }
    if (tag.authorId !== BigInt(interaction.user.id)) {
      return this.replyNotOwner(interaction)
    }

    await db.delete(tags).where(eq(tags.id, tag.id))

    return interaction.reply({
      content: (await resolveKey(interaction, 'commands/tag:deleted', {
        name: tag.name,
      })) as string,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    })
  }

  public async chatInputList(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    const author = interaction.options.getUser('author')
    const query = db.select({ name: tags.name }).from(tags)
    const rows = await (author
      ? query.where(eq(tags.authorId, BigInt(author.id)))
      : query
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
        names: rows.map((row) => `\`${row.name}\``).join(', '),
      })) as string,
      allowedMentions: { parse: [] },
    })
  }

  public async chatInputInfo(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    const tag = await this.findTag(interaction.options.getString('name', true))
    if (!tag) {
      return this.replyNotFound(interaction)
    }

    return interaction.reply({
      content: (await resolveKey(interaction, 'commands/tag:info', {
        name: tag.name,
        authorId: tag.authorId.toString(),
        length: tag.content.length,
      })) as string,
      allowedMentions: { parse: [] },
    })
  }

  public async chatInputRaw(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    const tag = await this.findTag(interaction.options.getString('name', true))
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

  private findTag(name: string) {
    return db.query.tags.findFirst({ where: eq(tags.name, name.trim()) })
  }

  private async replyNotFound(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    const name = interaction.options.getString('name', true)
    // pg_trgm "did you mean": the closest existing name, if it's close
    // enough to plausibly be a typo.
    const [closest] = await db
      .select({ name: tags.name })
      .from(tags)
      .where(sql`similarity(${tags.name}, ${name}) > 0.3`)
      .orderBy(sql`similarity(${tags.name}, ${name}) DESC`)
      .limit(1)

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
    interaction: Subcommand.ChatInputCommandInteraction,
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
