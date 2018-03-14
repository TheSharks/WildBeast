const commands = require('./directory-loader')('./src/commands')

const misc = [
  'If you want more information on the commands, check the command reference at http://docs.thesharks.xyz/commands.',
  'For further questions, join our server: discord.gg/wildbot',
  'Like what we do? Consider supporting my developer at Patreon! <https://www.patreon.com/Dougley>' // escaping embed because we're not evil
]

let result = {}
const aliases = new Map()

for (const cmd in commands) {
  if (result[cmd]) global.logger.error(`Unable to register command ${cmd}, a command with this name already exists.`, true)
  result[cmd] = commands[cmd]
  if (commands[cmd].meta.alias) {
    for (const x of commands[cmd].meta.alias) {
      if (commands[x]) global.logger.error(`Cannot set alias ${x}, there's a command with this name.`, true)
      if (aliases.has(x)) global.logger.error(`Cannot set ${x} as an alias of ${cmd}, it's already in use by ${aliases.get(x)}.`, true)
      aliases.set(x, cmd)
    }
  }
}

async function helpingHand (user, context, cmd) {
  if (aliases.has(cmd)) cmd = aliases.get(cmd)
  if (commands[cmd]) {
    const c = commands[cmd]
    const name = Object.getOwnPropertyNames(commands).find(f => commands[f] === c)
    let result = [
      `Command name: \`${name}\``,
      `Explanation: \`${c.meta.help}\``,
      '',
      'Example:',
      '```',
      c.meta.usage ? process.env.BOT_PREFIX + name + ' ' + c.meta.usage : process.env.BOT_PREFIX + name,
      '```',
      `Minimum access level required: ${c.meta.level}`,
      ''
    ]
    if (c.meta.module) result.push(`*This command is part of the \`${c.meta.module}\` module*`)
    if (c.meta.aliases && c.meta.aliases.length > 0) result.push(`**Aliases for this command:** ${c.meta.aliases.join(', ')}`)
    if (c.meta.timeout) result.push(`**This command has a timeout of ${c.meta.timeout} seconds**`)
    if (c.meta.nsfw) result.push('**This command is NSFW**')
    if (c.meta.addons) result.push(c.meta.addons)
    if (context.guild) {
      context.createMessage(`Please check your DMs!`)
      context = await global.bot.users.get(user).getDMChannel() // reassign context to be a dm channel
    }
    context.createMessage(result.join('\n'))
  } else if (!cmd) {
    // send all registered commands in a neat list
    const categories = new Set(Object.values(commands).map(x => x.meta.module).sort())
    const names = Object.getOwnPropertyNames(commands)
    const res = {}
    categories.forEach(cat => {
      const values = Object.values(commands).filter(y => y.meta.module === cat && y.meta.level !== Infinity)
      res[cat] = values.map(x => `${names.find(f => commands[f] === x)} = "${x.meta.help}"`).sort()
    })
    const result = [['[[Available commands]]']]
    for (const x in res) {
      if (!(result[result.length - 1].join('\n').length > 1750)) result[result.length - 1].push(`\n[${(x === 'undefined') ? 'Uncategorized' : x}]`)
      else result[result.length] = [`\n[${(x === 'undefined') ? 'Uncategorized' : x}]`]
      res[x].forEach(rep => {
        if (!(result[result.length - 1].join('\n').length > 1750)) result[result.length - 1].push(rep)
        else result[result.length] = [rep]
      })
    }
    if (context.guild) {
      context.createMessage(`Please check your DMs!`)
      context = await global.bot.users.get(user).getDMChannel() // reassign context to be a dm channel
    }
    for (const x in result) {
      context.createMessage(`\`\`\`ini\n${result[x].join('\n')}\n\`\`\``)
    }
    context.createMessage(misc.join('\n'))
  } else {
    return context.createMessage(`No command called \`${cmd}\` registered.`)
  }
}

module.exports = {
  commands: result,
  alias: aliases,
  help: helpingHand
}
