/* eslint-disable no-extend-native */

// Global String.prototype.replace polyfill
String.prototype.replaceAll = function (searchString, replaceString) {
  return this.split(searchString).join(replaceString)
}

const fs = require('fs-extra')
const commandInfo = require('../../commandInfo.json')

const files = {
  source: './docs/js/src/commands.js',
  dest: './docs/js/dist/commands.js.temp'
}

try {
  if (fs.existsSync(files.dest)) fs.unlink(files.dest) // Cleanup potential old version
  fs.copySync(files.source, files.dest)
  // Inject runner code to end of file
  fs.appendFileSync(files.dest, `\nconst commandInfo = JSON.parse(\`${cleanupJSON(commandInfo)}\`)\ngenerateCommandDocs(commandInfo)\n`)
} catch (err) {
  console.error(err)
}

function cleanupJSON (parsedJSON) {
  let str = JSON.stringify(parsedJSON)
  str = str.replaceAll('\\"', '\\\\"') // Properly escape double quotes
  str = str.replaceAll('\\n', '\\\\n') // Properly escape newlines

  return str
}
