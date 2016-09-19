'use strict'

var Request = require('request')
var SemVer = require('semver')

var version = require('../../package.json').version
var githubURL = 'https://raw.githubusercontent.com/TheSharks/WildBeast/master/package.json'

exports.getCurrentVersion = function () {
  return SemVer.valid(version)
}
exports.getCurrentMajor = function () {
  return SemVer.major(version)
}
exports.getCurrentMinor = function () {
  return SemVer.minor(version)
}
exports.getCurrentPatch = function () {
  return SemVer.patch(version)
}

exports.getLatestVersion = function (callback) {
  Request(githubURL, (error, response, body) => {
    if (error) return callback(error, null)
    if (response.statusCode === 200) {
      let latest = JSON.parse(body).version
      return callback(null, SemVer.valid(latest))
    }
  })
}

exports.getLatestMajor = function (callback) {
  exports.getLatestVersion((error, latest) => {
    if (error) return callback(error, null)
    return callback(null, SemVer.major(latest))
  })
}

exports.getLatestMinor = function (callback) {
  exports.getLatestVersion((error, latest) => {
    if (error) return callback(error, null)
    return callback(null, SemVer.minor(latest))
  })
}

exports.getLatestPatch = function (callback) {
  exports.getLatestVersion((error, latest) => {
    if (error) return callback(error, null)
    return callback(null, SemVer.patch(latest))
  })
}

exports.versionCheck = function (callback) {
  exports.getLatestVersion((error, latest) => {
    if (error) return callback(error, null)
    return callback(null, `You are running on version ${version}, the latest version is ${latest}`)
  })
}
