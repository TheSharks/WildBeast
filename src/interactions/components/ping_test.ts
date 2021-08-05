import { Interaction } from 'detritus-client/lib/structures'
import { cache } from '../../cache'

cache.components.set('ping_test', async (payload: Interaction) => {
  await payload.respond({
    type: 4,
    data: {
      content: 'Hello world!',
      flags: 64
    }
  })
})
