import { Interaction, InteractionDataComponent } from 'detritus-client/lib/structures'
import { cache } from '../../cache'
import { SelectMenuComponent } from '../../classes/SelectMenuComponent'
import fetch from 'node-fetch'

const interaction = new SelectMenuComponent({
  id: 'voice_search_menu',
  placeholder: 'What would you like to play?',
  data: [], // this is set on the fly
  fn: async (payload: Interaction) => {
    await payload.respond(6)
    const player = cache.lavalink.get(payload.guildId!)!
    const selected = (payload.data as InteractionDataComponent).values![0]
    const data = await player.encoder.node.loadTracks(`https://youtu.be/${selected}`)
    const extras = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${selected}&key=${process.env.YOUTUBE_API_KEY!}`)).json()
    player.playlist.push(Object.assign(data.tracks[0], { extras }))
    player.textChannel = payload.channel!
    await player.next()
    await payload.editOrRespond({
      content: data.tracks[0].info.title,
      components: []
    })
  }
})

cache.components.set(interaction.id, interaction)

export default interaction
