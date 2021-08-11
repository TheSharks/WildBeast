import { Interaction, InteractionDataComponent } from 'detritus-client/lib/structures'
import { cache } from '../../cache'
import { SelectMenuComponent } from '../../classes/SelectMenuComponent'
import { authorImg, getVideo } from '../../components/invidious'

const interaction = new SelectMenuComponent({
  id: 'voice_search_menu',
  placeholder: 'What would you like to play?',
  data: [], // this is set on the fly
  fn: async (payload: Interaction) => {
    await payload.respond(6)
    const player = cache.lavalink.get(payload.guildId!)!
    const selected = (payload.data as InteractionDataComponent).values![0]
    const data = await getVideo(selected)
    const track = await player.encoder.node.loadTracks(data.formatStreams[0].url)
    player.playlist.push(Object.assign(track.tracks[0], {
      info: {
        ...track.tracks[0].info,
        author: data.author,
        title: data.title,
        uri: `https://youtu.be/${data.videoId}`,
        image: `https://i.ytimg.com/vi/${data.videoId}/hqdefault.jpg`,
        authorImage: authorImg(data),
        authorURL: `https://youtube.com${data.authorUrl}`
      },
      i7s: { otf: false }
    }))
    player.textChannel = payload.channel!
    await player.next()
    await payload.editOrRespond({
      content: data.title,
      components: []
    })
  }
})

cache.components.set(interaction.id, interaction)

export default interaction
