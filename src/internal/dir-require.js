/**
 * Index and require all files in a directory
 * The name of the file will be used as reference
 * @param {String} globPattern - A glob compatible pattern to match files against
 * @type {Object}
 */

const glob = require('glob')
const path = require('path')

module.exports = (globPattern) => {
  const files = glob.sync(globPattern, {
    absolute: true
  })
  const returnValue = {}
  files.forEach(x => {
    const basename = path.basename(x, path.extname(x))
    returnValue[basename] = require(x)
  })
  return returnValue
}
