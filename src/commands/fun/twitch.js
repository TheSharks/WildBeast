const SA = require('superagent')
const Command = require('../../classes/Command')

module.exports = new Command(async (msg, suffix) => {
	if (!suffix) return msg.channel.createMessage('No channel specified!')
	const user = await getUser(suffix);
	if(!user) return msg.channel.createMessage(`**${suffix}** isn't a valid channel.`)
	SA.get(`https://api.twitch.tv/kraken/streams/${user}`)
		.set({ 'Accept': 'application/vnd.twitchtv.v5+json', 'Client-ID': process.env.TWITCH_ID })
		.end((err, response) => {
			if (err) {
				global.logger.error(err)
				return msg.channel.createMessage('We ran into an error, sorry about that!')
			}
			response.body.stream ? msg.channel.createMessage(getEmbed(response.body)) :
				msg.channel.createMessage(`**${suffix}** is not currently streaming.`)
		})
},
{
  aliases: ['tw'],
  requiredPermissions: {
    channel: ['embedLinks']
  }
})

async function getUser(suffix) {
  const res = await SA.get(`https://api.twitch.tv/kraken/users?login=${suffix}`)
  .set({ 'Accept': 'application/vnd.twitchtv.v5+json', 'Client-ID': process.env.TWITCH_ID })
  return res.body._total ? res.body.users[0]._id: false
}

function getEmbed(resp) {
	const stream = resp.stream
	const name = resp.stream.channel.display_name
	return {
		content: `**${name}** is currently live at <https://twitch.tv/${name}>.`,
		embed: {
        "url": `https://twitch.tv/${name}`,
        "title": stream.channel.status,
        "color": 9442302,
        "fields": [{
            "name": "Game",
            "value": stream.game,
            "inline": true
        }, {
            "name": "Viewers",
            "value": stream.viewers,
            "inline": true
        }, {
            "name": "Total Views",
            "value": stream.channel.views,
            "inline": true
        }],
        "image": {
            "url": stream.preview.large
        },
        "thumbnail": {
            "url": stream.channel.logo
        }
    }
	}
}
