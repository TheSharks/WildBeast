/**
 * Indexer for all events the program should listen for
 * All events are located in /src/events, and can be multiple directories deep
 * @type {Object}
 */

const glob = require('glob')
const events = glob.sync('src/events/**/*.js')
const path = require('path')
const indexed = events.map(x => x.split('/').splice(2))
const final = {}

indexed.forEach(contents => {
  try {
    contents[0] = path.basename(contents[0], '.js') // remove the .js suffix if there is any
    if (!final[contents[0]]) final[contents[0]] = [] // secure there's an array
    final[contents[0]].push(
      require(path.normalize(`${process.cwd()}/src/events/${contents.join('/')}`))
    )
  } catch (e) {
    logger.error('EVENTS', e)
  }
})

logger.trace('EVENTS', final)
module.exports = final
