import { ClientEvents } from 'detritus-client/lib/constants'
import client from '../structures/client'

const responseTriggers = [
  '8ball', 'advice', 'dice',
  'fact', 'inspire', 'jpeg',
  'leetspeak', 'randomcat', 'randomdog',
  'randommeme', 'stroke', 'tag',
  'twitch', 'urbandictionary', 'xkcd',
  'ban', 'kick', 'purge',
  'softban', 'fastforward', 'joinvoice',
  'leavevoice', 'newdj', 'play',
  'queue', 'remove', 'rewind',
  'shuffle', 'skip', 'volume',
  'booru', 'e621', 'rule34',
  'eval', 'info', 'invite',
  'ping', 'renegotiate-scaling', 'say',
  'leetspeek', 'leetspeech', 'leet',
  'cat', 'dog', 'tw',
  'ud', 'clean', 'filter',
  'ff', 'voice', 'join-voice',
  'leave-voice', 'stop', 'new-dj',
  'new-djs', 'newdjs', 'request',
  'playlist', 'pl', 'rem',
  'rw', 'e6', 'r34',
  'stats'
]

client.client.subscribe(ClientEvents.MESSAGE_CREATE, async function (data) {
  if (data.message.content.startsWith(process.env.ROLLOVER_PREFIX ?? '++') && responseTriggers.some(trigger => data.message.content.toLowerCase().startsWith(`++${trigger}`))) {
    await data.message.reply([
      "Hey! I don't respond to messages anymore, please use slash commands",
      "Just type `/` in the chat, you'll see all the command there instead!",
      "Don't see any commands? Please reinvite me at https://invite.thesharks.xyz"
    ].join('\n'))
  }
})
