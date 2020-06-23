const Command = require('../../classes/Command')

module.exports = new Command(async (msg, suffix) => {
  const driver = require('../../database/drivers/tags')
  const compiler = require('@thesharks/jagtag-js')
  const client = require('../../components/client')
  const chunks = suffix.split(' ')
  let tag = (await driver.get(chunks[0]))[0]
  switch (chunks[0]) {
    case 'create': {
      tag = (await driver.get(chunks[1]))[0]
      if (['create', 'raw', 'owner', 'edit', 'delte', 'import'].includes(chunks[1])) return msg.channel.createMessage("You can't name your tag that")
      if (tag) return msg.channel.createMessage('A tag with that name already exists')
      else return createNewTag(msg, chunks)
    }
    case 'raw': {
      tag = (await driver.get(chunks[1]))[0]
      if (!tag) return msg.channel.createMessage('No such tag')
      else return msg.channel.createMessage(tag.content)
    }
    case 'owner': {
      tag = (await driver.get(chunks[1]))[0]
      const user = await client.getRESTUser(tag.owner_id)
      return msg.channel.createMessage(`The owner of that tag is ${user.username}#${user.discriminator}`)
    }
    case 'edit': {
      tag = (await driver.get(chunks[1]))[0]
      if (!tag) return msg.channel.createMessage('No such tag')
      else return editTag(tag, msg, chunks)
    }
    case 'delete': {
      tag = (await driver.get(chunks[1]))[0]
      if (!tag) return msg.channel.createMessage('No such tag')
      else return deleteTag(tag, msg)
    }
    default: {
      if (!tag) return msg.channel.createMessage('No such tag')
      return msg.channel.createMessage(compiler(tag.content, {
        tagArgs: chunks.slice(2),
        author: msg.author,
        channel: msg.channel,
        guild: msg.channel.guild,
        channels: msg.channel.guild ? msg.channel.guild.channels : [],
        members: msg.channel.guild ? msg.channel.guild.members : []
      }))
    }
  }
})

const createNewTag = async (msg, chunks) => {
  const driver = require('../../database/drivers/tags')
  await driver.create({
    name: chunks[1],
    content: chunks.slice(2).join(' '),
    owner_id: msg.author.id,
    guild_id: msg.channel.guild ? msg.channel.guild.id : 'DM'
  })
  return msg.channel.createMessage('Your tag was created')
}

const editTag = async (tag, msg, chunks) => {
  const driver = require('../../database/drivers/tags')
  if (msg.author.id !== tag.owner_id && !process.env.WILDBEAST_MASTERS.split(',').includes(msg.author.id)) return msg.channel.createMessage('This tag is not yours to edit')
  await driver.edit({
    ...tag,
    content: chunks.slice(2).join(' ')
  })
  return msg.channel.createMessage('Your tag was edited')
}

const deleteTag = async (tag, msg) => {
  const driver = require('../../database/drivers/tags')
  if (msg.author.id !== tag.owner_id && !process.env.WILDBEAST_MASTERS.split(',').includes(msg.author.id)) return msg.channel.createMessage('This tag is not yours to edit')
  await driver.delete(tag.name)
  return msg.channel.createMessage('Your tag was deleted')
}
