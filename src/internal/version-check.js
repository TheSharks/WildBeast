(async () => {
  const SA = require('superagent')
  const local = require('../../package.json').version
  const stable = await SA.get('https://raw.githubusercontent.com/TheSharks/WildBeast/master/package.json')
  const exp = await SA.get('https://raw.githubusercontent.com/TheSharks/WildBeast/experimental/package.json')
  global.logger.log(`Latest stable version: ${JSON.parse(stable.text).version}. Latest experimental version: ${JSON.parse(exp.text).version}`)
  if (local !== JSON.parse(stable.text).version && local !== JSON.parse(exp.text).version) {
    global.logger.warn('Not up-to-date with any remote version, update recommended')
  }
})()
