var directory = require('require-directory')
var blacklist = /dbcreate\.js$/
module.exports = directory(module, {exclude: blacklist})
