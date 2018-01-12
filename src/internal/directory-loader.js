module.exports = function (location) {
  let result = {}
  require('fs').readdirSync(location).forEach(function (file) {
    if (file.match(/\.js$/) !== null) {
      let name = file.replace('.js', '')
      result[name] = require(require('path').resolve(location, name))
    }
  })
  return result
}
