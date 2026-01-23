import { describe, expect, it } from 'vitest'
import { render } from '../src/index.js'

describe('core tags', () => {
  it('upper and lower work', async () => {
    expect((await render('{upper:hi}')).output).toBe('HI')
    expect((await render('{lower:HI}')).output).toBe('hi')
  })

  it('args + arg', async () => {
    const result = await render('{args}-{arg:1}', { args: ['a', 'b'] })
    expect(result.output).toBe('a b-b')
  })

  it('set/get variables', async () => {
    const result = await render('{set:x|y}{get:x}')
    expect(result.output).toBe('y')
  })

  it('argslen returns correct length', async () => {
    expect((await render('{argslen}')).output).toBe('0')
    expect((await render('{argslen}', { args: [] })).output).toBe('0')
    expect((await render('{argslen}', { args: ['a', 'b', 'c'] })).output).toBe(
      '3',
    )
  })

  it('delete removes variables', async () => {
    const result = await render('{set:x|y}{get:x}{delete:x}{get:x}')
    expect(result.output).toBe('yundefined')
  })

  it('length returns string length', async () => {
    expect((await render('{length:hello}')).output).toBe('5')
    expect((await render('{length:}')).output).toBe('0')
    expect((await render('{length:😀😀😀}')).output).toBe('6')
  })

  it('replace works with literal matching', async () => {
    expect((await render('{replace:hello world|world|there}')).output).toBe(
      'hello there',
    )
    expect((await render('{replace:aaa|a|b}')).output).toBe('bbb')
    expect((await render('{replace:test-today|today|yesterday}')).output).toBe(
      'test-yesterday',
    )
    expect((await render('{replace:hello world|||empty}')).output).toBe(
      'hello world',
    )
  })

  it('reverse reverses string', async () => {
    expect((await render('{reverse:hello}')).output).toBe('olleh')
    expect((await render('{reverse:}')).output).toBe('')
    expect((await render('{reverse:a}')).output).toBe('a')
  })

  it('abs returns absolute value', async () => {
    expect((await render('{abs:5}')).output).toBe('5')
    expect((await render('{abs:-5}')).output).toBe('5')
    expect((await render('{abs:0}')).output).toBe('0')
    expect((await render('{abs:-3.14}')).output).toBe('3.14')
  })

  it('sin calculates sine', async () => {
    expect((await render('{sin:0}')).output).toBe('0')
    expect(parseFloat((await render('{sin:1.5708}')).output)).toBeCloseTo(1, 3)
  })

  it('cos calculates cosine', async () => {
    expect(parseFloat((await render('{cos:0}')).output)).toBeCloseTo(1, 3)
    expect(parseFloat((await render('{cos:3.14159}')).output)).toBeCloseTo(
      -1,
      3,
    )
  })

  it('tan calculates tangent', async () => {
    expect((await render('{tan:0}')).output).toBe('0')
    expect(parseFloat((await render('{tan:0.7854}')).output)).toBeCloseTo(1, 3)
  })

  it('sqrt calculates square root', async () => {
    expect((await render('{sqrt:4}')).output).toBe('2')
    expect((await render('{sqrt:9}')).output).toBe('3')
    expect((await render('{sqrt:0}')).output).toBe('0')
  })

  it('sqrt returns error for negative numbers', async () => {
    const result = await render('{sqrt:-1}')
    expect(result.output).toBe(
      'Error: cannot calculate square root of negative number',
    )
    expect((await render('{sqrt:-100}')).output).toBe(
      'Error: cannot calculate square root of negative number',
    )
  })

  it('pi returns PI', async () => {
    expect((await render('{pi}')).output).toBe(String(Math.PI))
  })

  it('e returns E', async () => {
    expect((await render('{e}')).output).toBe(String(Math.E))
  })

  it('choose randomly selects option', async () => {
    const result = await render('{choose:apple|banana|cherry}')
    expect(['apple', 'banana', 'cherry']).toContain(result.output)
  })

  it('choose handles empty input', async () => {
    expect((await render('{choose:}')).output).toBe('')
    expect((await render('{choose:|||}')).output).toBe('')
  })

  it('range generates number sequence', async () => {
    expect((await render('{range:0|5}')).output).toBe('0 1 2 3 4')
    expect((await render('{range:1|6}')).output).toBe('1 2 3 4 5')
    expect((await render('{range:0|10|2}')).output).toBe('0 2 4 6 8')
    expect((await render('{range:5|5}')).output).toBe('')
  })

  it('range returns error for non-positive step', async () => {
    expect((await render('{range:0|10|0}')).output).toBe(
      'Error: step must be positive',
    )
    expect((await render('{range:0|10|-1}')).output).toBe(
      'Error: step must be positive',
    )
    expect((await render('{range:0|10|-5}')).output).toBe(
      'Error: step must be positive',
    )
  })

  it('now returns current timestamp', async () => {
    const result = await render('{now}')
    const timestamp = parseInt(result.output, 10)
    const current = Date.now()
    expect(timestamp).toBeGreaterThan(current - 1000)
    expect(timestamp).toBeLessThanOrEqual(current)
  })

  it('time returns timestamp by default', async () => {
    const result = await render('{time}')
    const timestamp = parseInt(result.output, 10)
    const current = Date.now()
    expect(timestamp).toBeGreaterThan(current - 1000)
    expect(timestamp).toBeLessThanOrEqual(current)
  })

  it('time with format timestamp returns timestamp', async () => {
    const result = await render('{time:timestamp}')
    const timestamp = parseInt(result.output, 10)
    const current = Date.now()
    expect(timestamp).toBeGreaterThan(current - 1000)
    expect(timestamp).toBeLessThanOrEqual(current)
  })

  it('time with format iso returns ISO string', async () => {
    const result = await render('{time:iso}')
    expect(result.output).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    )
  })
})
