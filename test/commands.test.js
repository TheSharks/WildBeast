/* eslint-disable */
process.env.WILDBEAST_MASTERS = '123' // HACK: some commands expect this to be present

const assert = require('assert')
const commands = require('../src/internal/command-indexer').commands

describe('Command tests', () => {
  for (const x in commands) {
    describe(x, () => {
      it('has a function', done => {
        assert.ok(typeof commands[x].fn === 'function')
        done()
      })
      it('has required metadata', done => {
        assert.ok(typeof commands[x].meta === 'object')
        assert.ok(typeof commands[x].meta.level === 'number')
        assert.ok(typeof commands[x].meta.help === 'string')
        done()
      })
      if (commands[x].meta.alias !== undefined) {
        it('has valid alias configuration', done => {
          assert.ok(Array.isArray(commands[x].meta.alias))
          done()
        })
      }
      if (commands[x].meta.timeout !== undefined) {
        it('has valid timeout configuration', done => {
          assert.ok(typeof commands[x].meta.timeout === 'number')
          done()
        })
      }
    })
  }
})
