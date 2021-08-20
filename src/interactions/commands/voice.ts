import { ShardClient } from 'detritus-client'
import { Interaction, InteractionDataApplicationCommand } from 'detritus-client/lib/structures'
import { RequestTypes } from 'detritus-client-rest'
import { cache } from '../../cache'
import { Command } from '../../classes/Command'
import VoiceSearchMenu from '../components/voice_search_menu'
import CancelButton from '../components/cancel_button'
import { LoadType } from '@lavaclient/types'

const command = new Command({
  name: 'voice',
  description: 'Connect the bot to a voice channel',
  options: [
    {
      type: 2,
      name: 'stream',
      description: 'Options to manage the stream',
      options: [
        { type: 1, name: 'start', description: 'Start streaming' },
        { type: 1, name: 'stop', description: 'Stop streaming' }
      ]
    },
    {
      type: 1,
      name: 'search',
      description: 'Search for a track to play',
      options: [
        { type: 3, name: 'query', description: 'Query to search for', required: true }
      ]
    }
  ],
  function: {
    run: async function (interaction: Interaction, shard: ShardClient) {
      const { fullName } = interaction.data as InteractionDataApplicationCommand
      switch (fullName) {
        case 'voice search': {
          const value = (interaction.data as InteractionDataApplicationCommand).options!.get('search')!.options!.get('query')!.value
          const encoder = cache.lavalink.get(interaction.guild!.id)
          // const data = await search(value as string)
          const data = await encoder?.encoder.node.loadTracks(`ytsearch:${value as string}`)
          if (data?.loadType === LoadType.SearchResult) {
            const values: RequestTypes.CreateChannelMessageComponentSelectMenuOption[] = data.tracks
              .slice(0, 5)
              .map(x => { return { label: x.info.title, value: x.info.identifier, description: x.info.author, emoji: { name: 'youtube', id: '314349922885566475' } } })
            const menu = Object.assign(VoiceSearchMenu, { data: values })
            await this.safeReply(interaction, {
              content: 'done',
              components: [
                { type: 1, components: [menu.toJSON()] },
                { type: 1, components: [CancelButton.toJSON()] }
              ]
            })
          } else {
            await this.safeReply(interaction, { content: 'no results' })
          }
          break
        }
        case 'voice stream start': {
          const channel = shard.voiceStates.get(interaction.guildId!)?.get(interaction.userId)?.channelId
          if (channel === undefined) {
            await this.safeReply(interaction, 'You are not connected to a voice channel.')
            break
          }
          await cache.lavalink.join(interaction.guildId!, channel!, shard)
          await this.safeReply(interaction, 'Done')
          break
        }
        case 'voice stream stop': {
          const channel = cache.lavalink.get(interaction.guildId!)
          if (channel === undefined) {
            await this.safeReply(interaction, "I'm not connected to a voice channel.")
            break
          }
          channel.destroy()
          await this.safeReply(interaction, 'Done')
          break
        }
      }
    }
  }
})

cache.commands.set(command.name, command)
export default command
