'use strict'
var directory = require('require-directory')
module.exports = directory(module, './databases/controllers')
