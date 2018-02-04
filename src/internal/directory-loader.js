module.exports = function (location, regex = /\.js$/) {
  let result = {}
  require('fs').readdirSync(location).forEach(function (file) {
    if (file.match(regex) !== null) {
      let name = file.replace(regex, '')
      result[name] = require(require('path').resolve(location, name))
    }
  })
  return result
}
