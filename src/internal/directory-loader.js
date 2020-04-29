const path = require('path')

module.exports = function (location, opts = {}) {
  const { regex, relative } = Object.assign({ regex: /\.js$/, relative: true }, opts)
  const result = {}

  if (relative) {
    const currentPath = path.dirname(new Error().stack.split('\n')[2].replace(/[^(]+\((.+):\d+:\d+\).*/g, (m, g1) => g1))
    location = path.resolve(currentPath, location)
  }

  require('fs').readdirSync(location).forEach(function (file) {
    if (regex.test(file)) {
      const name = file.replace(regex, '')
      result[name] = require(path.resolve(location, name))
    }
  })
  return result
}
