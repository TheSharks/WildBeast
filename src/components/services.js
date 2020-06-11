const dirreq = require('../internal/dir-require')
const services = dirreq('src/components/services/**/*.js')

const intervals = new Map()

Object.keys(services).forEach(x => {
  if (intervals.has(x)) return
  if (services[x].runCheck()) {
    intervals.set(x, setInterval(services[x].fn, services[x].interval))
  }
})

module.exports = intervals
