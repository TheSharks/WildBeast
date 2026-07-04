import { createRequire } from 'node:module'
import type { Command } from '@sapphire/framework'
import { applyLocalizedBuilder, resolveKey } from '@sapphire/plugin-i18next'
import {
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from 'discord.js'
import { TracedCommand } from '../../structures/command.mjs'

const { version } = createRequire(import.meta.url)('../../../package.json') as {
  version: string
}

export class InfoCommand extends TracedCommand {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) => {
      applyLocalizedBuilder(
        builder,
        'commands/names:info',
        'commands/descriptions:info',
      )
    })
  }

  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const { client } = this.container
    const label = (key: string) =>
      resolveKey(interaction, `commands/info:${key}`)

    const shards = client.options.shards
    const shardInfo = Array.isArray(shards)
      ? `${shards.join(', ')} / ${client.options.shardCount ?? '?'}`
      : `${client.options.shardCount ?? 1}`
    const readySeconds = Math.floor(
      (client.readyTimestamp ?? Date.now()) / 1000,
    )

    const lines = [
      `**${await label('guilds')}:** ${client.guilds.cache.size}`,
      `**${await label('uptime')}:** <t:${readySeconds}:R>`,
      `**${await label('shard')}:** ${shardInfo}`,
      `**${await label('version')}:** v${version}`,
      `**${await label('node')}:** ${process.version}`,
      `**${await label('os')}:** ${process.platform}`,
      `**${await label('ram')}:** ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    ]
    const cluster = process.env.WILDBEAST_CLUSTER_ID
    if (cluster) {
      lines.splice(3, 0, `**${await label('cluster')}:** ${cluster}`)
    }

    const container = new ContainerBuilder()
      .setAccentColor(0x00ae86)
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              [`## ${client.user?.username ?? 'WildBeast'}`, ...lines].join(
                '\n',
              ),
            ),
          )
          .setThumbnailAccessory(
            new ThumbnailBuilder().setURL(
              client.user?.displayAvatarURL() ?? '',
            ),
          ),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# ${await label('poweredBy')}`),
      )

    return interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    })
  }
}
