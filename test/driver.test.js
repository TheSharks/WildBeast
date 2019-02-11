/* eslint-disable */

const assert = require('assert')
const driver = require('../src/selectors/database-selector')

describe('Default database driver', () => {
  it('has all required methods', done => {
    const required =  [
      'getPerms',
      'getSettings',
      'getTag',
      'getFlags',
      'getArbitrary',
      'create',
      'delete',
      'edit']
    for (const y of required) assert.ok(driver[y] !== undefined)
    done()
  })
})
