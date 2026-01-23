import { describe, expect, it } from 'vitest'
import { render } from '../src/index.js'

describe('variable tags comprehensive', () => {
  describe('set', () => {
    it.each([
      ['{set:x|value}', undefined, ''],
      ['{set:|value}', {}, ''],
      ['{set}', {}, ''],
      ['{set:x|value}', {}, ''],
    ])('%s returns empty', async (input, variables, expected) => {
      const result = await render(input, { variables })
      expect(result.output).toBe(expected)
    })

    it('handles key without value', async () => {
      const variables: Record<string, string> = {}
      const result = await render('{set:x}', { variables })
      expect(result.output).toBe('')
      expect(variables.x).toBe('')
    })

    it('sets variable with value', async () => {
      const variables: Record<string, string> = {}
      await render('{set:x|hello}', { variables })
      expect(variables.x).toBe('hello')
    })

    it('overwrites existing variable', async () => {
      const variables: Record<string, string> = { x: 'old' }
      await render('{set:x|new}', { variables })
      expect(variables.x).toBe('new')
    })

    it('handles spaces in key', async () => {
      const result = await render('{set: x |value}', { variables: {} })
      expect(result.output).toBe('')
    })
  })

  describe('get', () => {
    it.each([
      ['{get:x}', undefined, 'undefined'],
      ['{get:}', {}, 'undefined'],
      ['{get}', {}, 'undefined'],
      ['{get:x}', { x: 'hello' }, 'hello'],
      ['{get:y}', { x: 'hello' }, 'undefined'],
      ['{get:x}', { x: '' }, ''],
      ['{get: x }', {}, 'undefined'],
    ])('%s with variables=%s returns %s', async (input, variables, expected) => {
      const result = await render(input, { variables })
      expect(result.output).toBe(expected)
    })

    it('gets variable set in same render', async () => {
      const result = await render('{set:x|value}{get:x}')
      expect(result.output).toBe('value')
    })
  })

  describe('delete', () => {
    it.each([
      ['{delete:x}', undefined, ''],
      ['{delete:}', {}, ''],
      ['{delete}', {}, ''],
    ])('%s returns empty', async (input, variables, expected) => {
      const result = await render(input, { variables })
      expect(result.output).toBe(expected)
    })

    it('deletes existing variable', async () => {
      const variables: Record<string, string> = { x: 'value' }
      await render('{delete:x}', { variables })
      expect(variables.x).toBeUndefined()
    })

    it('handles deleting non-existent variable', async () => {
      const variables: Record<string, string> = { x: 'value' }
      await render('{delete:y}', { variables })
      expect(variables.x).toBe('value')
    })

    it('returns empty string', async () => {
      const result = await render('{delete:x}', { variables: { x: 'value' } })
      expect(result.output).toBe('')
    })

    it('handles spaces in key', async () => {
      const result = await render('{delete: x }', { variables: { x: 'value' } })
      expect(result.output).toBe('')
    })

    it('get after delete returns undefined', async () => {
      const result = await render('{set:x|value}{delete:x}{get:x}')
      expect(result.output).toBe('undefined')
    })
  })

  describe('variable interactions', () => {
    it('can chain set and get', async () => {
      const result = await render('{set:a|1}{set:b|2}{get:a}{get:b}')
      expect(result.output).toBe('12')
    })

    it('handles nested variable access', async () => {
      const result = await render('{set:x|{upper:hello}}{get:x}')
      expect(result.output).toBe('HELLO')
    })

    it('handles variable with tags in value', async () => {
      const result = await render('{set:name|{arg:0}}{get:name}', {
        args: ['Alice'],
      })
      expect(result.output).toBe('Alice')
    })
  })

  describe('security', () => {
    it('should safely handle __proto__ key in Map without pollution', async () => {
      const result = await render('{set:__proto__|safe}{get:__proto__}')
      expect(result.output).toBe('safe')

      expect(({} as Record<string, unknown>).safe).toBeUndefined()
      expect(
        (Object as unknown as Record<string, unknown>).safe,
      ).toBeUndefined()
    })

    it('should not pollute input object prototype when syncing back', async () => {
      const vars: Record<string, unknown> = {}
      await render('{set:__proto__|pwned}', {
        variables: vars as Record<string, string>,
      })

      expect(({} as Record<string, unknown>).pwned).toBeUndefined()
    })
  })
})
