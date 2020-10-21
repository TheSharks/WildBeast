const Command = require('../../classes/Command')

module.exports = new Command(async function (msg, suffix) {
  const driver = require('../../database/drivers/tags')
  const compiler = require('@thesharks/jagtag-js')
  const client = require('../../components/client')
  const chunks = suffix.split(' ')
  let tag = (await driver.get(chunks[0]))[0]
  switch (chunks[0]) {
    case 'create': {
      tag = (await driver.get(chunks[1]))[0]
      if (['create', 'raw', 'owner', 'edit', 'delete', 'import'].includes(chunks[1])) return this.safeSendMessage(msg.channel, i18n.t('commands.tag.errors.illegal'))
      if (tag) return this.safeSendMessage(msg.channel, i18n.t('commands.tag.errors.conflict'))
      else return createNewTag(msg, chunks)
    }
    case 'raw': {
      tag = (await driver.get(chunks[1]))[0]
      if (!tag) return this.safeSendMessage(msg.channel, i18n.t('commands.tag.errors.notFound'))
      else return this.safeSendMessage(msg.channel, tag.content)
    }
    case 'owner': {
      tag = (await driver.get(chunks[1]))[0]
      if (!tag) return this.safeSendMessage(msg.channel, i18n.t('commands.tag.errors.notFound'))
      const user = await client.getRESTUser(tag.owner_id)
      return this.safeSendMessage(msg.channel, i18n.t('commands.tag.owner', { owner: `${user.username}#${user.discriminator}` }))
    }
    case 'edit': {
      tag = (await driver.get(chunks[1]))[0]
      if (!tag) return this.safeSendMessage(msg.channel, i18n.t('commands.tag.errors.notFound'))
      else return editTag(tag, msg, chunks)
    }
    case 'delete': {
      tag = (await driver.get(chunks[1]))[0]
      if (!tag) return this.safeSendMessage(msg.channel, i18n.t('commands.tag.errors.notFound'))
      else return deleteTag(tag, msg)
    }
    default: {
      if (!tag) return this.safeSendMessage(msg.channel, i18n.t('commands.tag.errors.notFound'))
      return this.safeSendMessage(msg.channel, compiler(tag.content, {
        tagArgs: chunks.slice(1),
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
  return module.exports.safeSendMessage(msg.channel, i18n.t('commands.tag.created'))
}

const editTag = async (tag, msg, chunks) => {
  const driver = require('../../database/drivers/tags')
  if (msg.author.id !== tag.owner_id && !process.env.WILDBEAST_MASTERS.split(',').includes(msg.author.id)) return this.safeSendMessage(msg.channel, i18n.t('commands.tag.errors.notYours'))
  await driver.edit({
    ...tag,
    content: chunks.slice(2).join(' ')
  })
  return module.exports.safeSendMessage(msg.channel, i18n.t('commands.tag.edited'))
}

const deleteTag = async (tag, msg) => {
  const driver = require('../../database/drivers/tags')
  if (msg.author.id !== tag.owner_id && !process.env.WILDBEAST_MASTERS.split(',').includes(msg.author.id)) return this.safeSendMessage(msg.channel, i18n.t('commands.tag.errors.notYours'))
  await driver.delete(tag.name)
  return module.exports.safeSendMessage(msg.channel, i18n.t('commands.tag.deleted'))
}
