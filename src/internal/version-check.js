const SA = require('superagent')
const local = require('../../package.json').version

SA.get('https://raw.githubusercontent.com/TheSharks/WildBeast/master/package.json').then((c) => {
  const latest = JSON.parse(c.text).version
  if (local !== latest) {
    global.logger.warn(`Version mismatch, latest is ${latest}, currently running ${local}`)
  }
})
