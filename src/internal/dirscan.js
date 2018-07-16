const fs = require('fs')
const path = require('path')

module.exports = (location) => {
  const currentPath = path.dirname(new Error().stack.split('\n')[2].replace(/[^(]+\((.+):\d+:\d+\).*/g, (m, g1) => g1))
  location = path.resolve(currentPath, location)
  return fs.readdirSync(location)
}
