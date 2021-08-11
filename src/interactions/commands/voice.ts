import { ShardClient } from 'detritus-client'
import { Interaction, InteractionDataApplicationCommand } from 'detritus-client/lib/structures'
import { RequestTypes } from 'detritus-client-rest'
import { cache } from '../../cache'
import { Command } from '../../classes/Command'
import { search } from '../../components/invidious'
import VoiceSearchMenu from '../components/voice_search_menu'
import CancelButton from '../components/cancel_button'

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
          const data = await search(value as string)
          const values: RequestTypes.CreateChannelMessageComponentSelectMenuOption[] = data
            .filter(x => x.type === 'video')
            .slice(0, 5)
            .map(x => { return { label: x.title, value: x.videoId, description: x.author, emoji: { name: '📺' } } })
          const menu = Object.assign(VoiceSearchMenu, { data: values })
          await this.safeReply(interaction, {
            content: 'done',
            components: [
              { type: 1, components: [menu.toJSON()] },
              { type: 1, components: [CancelButton.toJSON()] }
            ]
          })
          break
        }
        case 'voice stream start': {
          await cache.lavalink.join('110462143152803840', '302538492393816086', shard)
          await this.safeReply(interaction, 'Done')
        }
      }
    }
  }
})

cache.commands.set(command.name, command)
export default command
