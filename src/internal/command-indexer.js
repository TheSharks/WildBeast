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
    const name = Object.getOwnPropertyNames(commands).filter(f => commands[f] === c)[0]
    let result = [
      `Command name: \`${name}\``,
      `Explanation: \`${c.meta.help}\``,
      '',
      'Example:',
      '```',
      c.meta.usage ? process.env.BOT_PREFIX + name + ' ' + c.meta.usage : process.env.BOT_PREFIX + name,
      '```',
      `Minimum access level required: ${c.meta.level}`
    ]
    if (c.meta.aliases && c.meta.aliases.length > 0) result.push(`**Aliases for this command:** ${c.meta.aliases.join(', ')}`)
    if (c.meta.timeout) result.push(`**This command has a timeout of ${c.meta.timeout} seconds**`)
    if (c.meta.nsfw) result.push('**This command is NSFW**')
    if (context.guild) {
      context.createMessage(`Please check your DMs!`)
      context = await global.bot.users.get(user).getDMChannel() // reassign context to be a dm channel
    }
    context.createMessage(result.join('\n'))
  } else if (!cmd) {
    // send all registered commands in a neat list
    let counter = 0
    let sorts = {
      0: [
        '[Available commands]\n'
      ]
    }
    for (const cmd in commands) {
      if (!commands[cmd].meta.hidden && commands[cmd].meta.level !== Infinity) {
        if (sorts[counter].join('\n').length > 1750) {
          counter++
          sorts[counter] = []
        }
        sorts[counter].push(cmd + ' = "' + commands[cmd].meta.help + '"')
      }
    }
    if (context.guild) {
      context.createMessage(`Please check your DMs!`)
      context = await global.bot.users.get(user).getDMChannel() // reassign context to be a dm channel
    }
    for (const x in sorts) {
      context.createMessage(`\`\`\`ini\n${sorts[x].sort().join('\n')}\n\`\`\``)
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
