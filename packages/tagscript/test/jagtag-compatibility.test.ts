import { describe, expect, it } from 'vitest'
import { createRegistry, render } from '../src/index.js'

describe('JagTag-JS Compatibility', () => {
  describe('Args tags', () => {
    describe('args', () => {
      it('returns correct values', async () => {
        const result = await render('{args}', { args: ['a', 'b', 'c'] })
        expect(result.output).toBe('a b c')
      })

      it('handles undefined args', async () => {
        const result = await render('{args}')
        expect(result.output).toBe('undefined')
      })

      it('handles empty args array', async () => {
        const result = await render('{args}', { args: [] })
        expect(result.output).toBe('undefined')
      })

      it('handles single arg', async () => {
        const result = await render('{args}', { args: ['hello'] })
        expect(result.output).toBe('hello')
      })

      it('handles args with spaces', async () => {
        const result = await render('{args}', {
          args: ['hello world', 'foo bar'],
        })
        expect(result.output).toBe('hello world foo bar')
      })
    })

    describe('arg', () => {
      it('returns correct value at index', async () => {
        const result = await render('{arg:0}', { args: ['a', 'b', 'c'] })
        expect(result.output).toBe('a')
      })

      it('handles undefined args context', async () => {
        const result = await render('{arg:0}')
        expect(result.output).toBe('undefined')
      })

      it('handles empty args array', async () => {
        const result = await render('{arg:0}', { args: [] })
        expect(result.output).toBe('undefined')
      })

      it('handles index out of bounds', async () => {
        const result = await render('{arg:10}', { args: ['a', 'b', 'c'] })
        expect(result.output).toBe('undefined')
      })

      it('handles undefined index', async () => {
        const result = await render('{arg}', { args: ['a', 'b', 'c'] })
        expect(result.output).toBe('undefined')
      })
    })

    describe('argslen', () => {
      it('returns correct length', async () => {
        const result = await render('{argslen}', { args: ['a', 'b', 'c'] })
        expect(result.output).toBe('3')
      })

      it('handles undefined args context', async () => {
        const result = await render('{argslen}')
        expect(result.output).toBe('0')
      })

      it('handles empty args array', async () => {
        const result = await render('{argslen}', { args: [] })
        expect(result.output).toBe('0')
      })
    })
  })

  describe('Functional tags', () => {
    describe('note', () => {
      it('returns empty string', async () => {
        const result = await render('{note:some content}')
        expect(result.output).toBe('')
      })
    })

    describe('choose', () => {
      it('returns random from pipe-delimited args', async () => {
        const result = await render('{choose:option1|option2|option3}')
        expect(['option1', 'option2', 'option3']).toContain(result.output)
      })

      it('returns empty for no args', async () => {
        const result = await render('{choose}')
        expect(result.output).toBe('')
      })
    })

    describe('if with operators', () => {
      it('supports equals (=) operator', async () => {
        const result = await render('{if:abc|=|abc|true|false}')
        expect(result.output).toBe('true')
      })

      it('supports equals (==) operator', async () => {
        const result = await render('{if:abc|==|abc|true|false}')
        expect(result.output).toBe('true')
      })

      it('supports not equals (!=) operator', async () => {
        const result = await render('{if:abc|!=|def|true|false}')
        expect(result.output).toBe('true')
      })

      it('supports strict not equals (!==) operator', async () => {
        const result = await render('{if:abc|!==|def|true|false}')
        expect(result.output).toBe('true')
      })

      it('supports greater than (>) operator', async () => {
        const result = await render('{if:10|>|5|true|false}')
        expect(result.output).toBe('true')
      })

      it('supports less than (<) operator', async () => {
        const result = await render('{if:5|<|10|true|false}')
        expect(result.output).toBe('true')
      })

      it('supports greater than or equal (>=) operator', async () => {
        const result = await render('{if:10|>=|10|true|false}')
        expect(result.output).toBe('true')
      })

      it('supports less than or equal (<=) operator', async () => {
        const result = await render('{if:5|<=|10|true|false}')
        expect(result.output).toBe('true')
      })

      it('evaluates false for greater than when false', async () => {
        const result = await render('{if:5|>|10|true|false}')
        expect(result.output).toBe('false')
      })

      it('evaluates false for less than when false', async () => {
        const result = await render('{if:10|<|5|true|false}')
        expect(result.output).toBe('false')
      })

      describe('levenshtein (~) operator', () => {
        it('matches strings with distance <= 2', async () => {
          expect((await render('{if:hello|~|hello|yes|no}')).output).toBe('yes')
          expect((await render('{if:hello|~|helo|yes|no}')).output).toBe('yes')
          expect((await render('{if:hello|~|hllo|yes|no}')).output).toBe('yes')
        })

        it('rejects strings with distance > 2', async () => {
          expect((await render('{if:hello|~|world|yes|no}')).output).toBe('no')
          expect((await render('{if:hello|~|abc|yes|no}')).output).toBe('no')
        })

        it('is case-insensitive', async () => {
          expect((await render('{if:HELLO|~|hello|yes|no}')).output).toBe('yes')
          expect((await render('{if:Hello|~|HELLO|yes|no}')).output).toBe('yes')
        })
      })

      describe('regex (?) operator', () => {
        it('matches regex patterns', async () => {
          expect((await render('{if:hello|?|^hello$|yes|no}')).output).toBe(
            'yes',
          )
          expect((await render('{if:hello|?|^h|yes|no}')).output).toBe('yes')
          expect((await render('{if:test123|?|\\d|yes|no}')).output).toBe('yes')
        })

        it('rejects non-matching patterns', async () => {
          expect((await render('{if:hello|?|world|yes|no}')).output).toBe('no')
          expect((await render('{if:test|?|\\d|yes|no}')).output).toBe('no')
        })

        it('handles invalid regex gracefully', async () => {
          expect((await render('{if:test|?|[invalid|yes|no}')).output).toBe(
            'no',
          )
        })
      })
    })
  })

  describe('String tags', () => {
    describe('upper', () => {
      it('converts to uppercase', async () => {
        const result = await render('{upper:hello}')
        expect(result.output).toBe('HELLO')
      })

      it('handles empty string', async () => {
        const result = await render('{upper:}')
        expect(result.output).toBe('')
      })

      it('handles undefined arg', async () => {
        const result = await render('{upper}')
        expect(result.output).toBe('')
      })
    })

    describe('lower', () => {
      it('converts to lowercase', async () => {
        const result = await render('{lower:HELLO}')
        expect(result.output).toBe('hello')
      })

      it('handles empty string', async () => {
        const result = await render('{lower:}')
        expect(result.output).toBe('')
      })

      it('handles undefined arg', async () => {
        const result = await render('{lower}')
        expect(result.output).toBe('')
      })
    })

    describe('length', () => {
      it('returns string length', async () => {
        const result = await render('{length:hello}')
        expect(result.output).toBe('5')
      })

      it('handles empty string', async () => {
        const result = await render('{length:}')
        expect(result.output).toBe('0')
      })

      it('handles undefined arg', async () => {
        const result = await render('{length}')
        expect(result.output).toBe('0')
      })
    })

    describe('url', () => {
      it('encodes URL components', async () => {
        const result = await render('{url:hello world}')
        expect(result.output).toBe('hello%20world')
      })

      it('handles special characters', async () => {
        const result = await render('{url:a&b=c}')
        expect(result.output).toBe('a%26b%3Dc')
      })

      it('handles empty string', async () => {
        const result = await render('{url:}')
        expect(result.output).toBe('')
      })

      it('handles undefined arg', async () => {
        const result = await render('{url}')
        expect(result.output).toBe('')
      })
    })

    describe('replace', () => {
      it('replaces all occurrences', async () => {
        const result = await render('{replace:banana|a|o}')
        expect(result.output).toBe('bonono')
      })

      it('handles empty text', async () => {
        const result = await render('{replace:|||b}')
        expect(result.output).toBe('')
      })

      it('handles empty search', async () => {
        const result = await render('{replace:abc|||x}')
        expect(result.output).toBe('abc')
      })

      it('handles empty replacement', async () => {
        const result = await render('{replace:hello world|world|}')
        expect(result.output).toBe('hello ')
      })
    })

    describe('replaceregex', () => {
      it('alias for replace', async () => {
        const result = await render('{replaceregex:banana|a|o}')
        expect(result.output).toBe('bonono')
      })
    })

    describe('substring', () => {
      it('extracts substring with start index', async () => {
        const result = await render('{substring:hello|1}')
        expect(result.output).toBe('ello')
      })

      it('extracts substring with start and end index', async () => {
        const result = await render('{substring:hello|1|4}')
        expect(result.output).toBe('ell')
      })

      it('handles empty string', async () => {
        const result = await render('{substring:|0|3}')
        expect(result.output).toBe('')
      })

      it('handles undefined args', async () => {
        const result = await render('{substring}')
        expect(result.output).toBe('')
      })

      it('handles out of range end', async () => {
        const result = await render('{substring:hello|1|100}')
        expect(result.output).toBe('ello')
      })
    })

    describe('oneline', () => {
      it('removes newlines', async () => {
        const result = await render(String.raw`{oneline:hello\nworld}`)
        expect(result.output).toBe('hello world')
      })

      it('handles multiple newlines', async () => {
        const result = await render(String.raw`{oneline:hello\n\nworld}`)
        expect(result.output).toBe('hello  world')
      })

      it('handles empty string', async () => {
        const result = await render('{oneline:}')
        expect(result.output).toBe('')
      })

      it('handles undefined arg', async () => {
        const result = await render('{oneline}')
        expect(result.output).toBe('')
      })
    })

    describe('hash', () => {
      it('returns numeric hash', async () => {
        const result = await render('{hash:hello}')
        expect(result.output).toMatch(/^-?\d+$/)
      })

      it('handles empty string', async () => {
        const result = await render('{hash:}')
        expect(result.output).toBe('0')
      })

      it('handles undefined arg', async () => {
        const result = await render('{hash}')
        expect(result.output).toBe('0')
      })

      it('returns consistent hash for same input', async () => {
        const result1 = await render('{hash:hello}')
        const result2 = await render('{hash:hello}')
        expect(result1.output).toBe(result2.output)
      })

      it('matches JagTag output for known values', async () => {
        expect((await render('{hash:test text}')).output).toBe('-1238303749')
        expect((await render('{hash:hello}')).output).toBe('99162322')
      })
    })

    describe('replace with JagTag syntax', () => {
      it('supports JagTag with: and in: syntax', async () => {
        expect(
          (
            await render(
              '{replace:hello|with:goodbye|in:Oh, hello! I say hello a lot!}',
            )
          ).output,
        ).toBe('Oh, goodbye! I say goodbye a lot!')
        expect(
          (await render('{replace:world|with:there|in:hello world}')).output,
        ).toBe('hello there')
      })

      it('maintains backwards compatibility with positional syntax', async () => {
        expect((await render('{replace:hello world|world|there}')).output).toBe(
          'hello there',
        )
        expect((await render('{replace:aaa|a|b}')).output).toBe('bbb')
      })
    })
  })

  describe('Variable tags', () => {
    describe('set', () => {
      it('sets variable', async () => {
        const variables: Record<string, string> = {}
        await render('{set:x|value}', { variables })
        expect(variables['x']).toBe('value')
      })

      it('handles empty keys', async () => {
        const variables: Record<string, string> = {}
        await render('{set:|value}', { variables })
        expect(variables['']).toBeUndefined()
      })

      it('allows reuse of variables', async () => {
        const result = await render('{set:x|value}{get:x}{set:x|new}{get:x}')
        expect(result.output).toBe('valuenew')
      })

      it('handles advanced [EX] syntax', async () => {
        const result = await render('{set:[EX]|value}{get:[EX]}')
        expect(result.output).toBe('value')
      })

      it('returns empty string', async () => {
        const result = await render('{set:x|value}')
        expect(result.output).toBe('')
      })
    })

    describe('get', () => {
      it('gets variable', async () => {
        const result = await render('{get:x}', { variables: { x: 'hello' } })
        expect(result.output).toBe('hello')
      })

      it('returns undefined for missing variable', async () => {
        const result = await render('{get:y}', { variables: { x: 'hello' } })
        expect(result.output).toBe('undefined')
      })

      it('handles empty key', async () => {
        const result = await render('{get:}', { variables: { x: 'hello' } })
        expect(result.output).toBe('undefined')
      })
    })

    describe('delete', () => {
      it('deletes variable', async () => {
        const variables: Record<string, string> = { x: 'value' }
        await render('{delete:x}', { variables })
        expect(variables['x']).toBeUndefined()
      })

      it('handles empty keys', async () => {
        const variables: Record<string, string> = { x: 'value' }
        await render('{delete:}', { variables })
        expect(variables['x']).toBe('value')
      })

      it('returns empty string', async () => {
        const result = await render('{delete:x}', { variables: { x: 'value' } })
        expect(result.output).toBe('')
      })
    })
  })

  describe('Math tags', () => {
    describe('addition', () => {
      it('adds two numbers', async () => {
        const result = await render('{add:5|3}')
        expect(result.output).toBe('8')
      })

      it('handles negative numbers', async () => {
        const result = await render('{add:-5|3}')
        expect(result.output).toBe('-2')
      })

      it('handles decimals', async () => {
        const result = await render('{add:5.5|3.5}')
        expect(result.output).toBe('9')
      })

      it('handles missing args', async () => {
        const result = await render('{add}')
        expect(result.output).toBe('')
      })
    })

    describe('subtraction', () => {
      it('subtracts two numbers', async () => {
        const result = await render('{subtract:10|3}')
        expect(result.output).toBe('7')
      })

      it('handles negative numbers', async () => {
        const result = await render('{subtract:5|-3}')
        expect(result.output).toBe('8')
      })

      it('handles decimals', async () => {
        const result = await render('{subtract:10.5|3.5}')
        expect(result.output).toBe('7')
      })
    })

    describe('division', () => {
      it('divides two numbers', async () => {
        const result = await render('{divide:10|2}')
        expect(result.output).toBe('5')
      })

      it('handles decimals', async () => {
        const result = await render('{divide:10|3}')
        const value = parseFloat(result.output)
        expect(value).toBeCloseTo(3.3333333333333335)
      })

      it('handles division by zero', async () => {
        const result = await render('{divide:10|0}')
        expect(['NaN', 'Infinity']).toContain(result.output)
      })
    })

    describe('multiplication', () => {
      it('multiplies two numbers', async () => {
        const result = await render('{multiply:5|3}')
        expect(result.output).toBe('15')
      })

      it('handles negative numbers', async () => {
        const result = await render('{multiply:-5|3}')
        expect(result.output).toBe('-15')
      })

      it('handles decimals', async () => {
        const result = await render('{multiply:2.5|4}')
        expect(result.output).toBe('10')
      })
    })

    describe('exponentiation', () => {
      it('raises to power', async () => {
        const result = await render('{pow:2|3}')
        expect(result.output).toBe('8')
      })

      it('handles decimal exponent', async () => {
        const result = await render('{pow:4|0.5}')
        expect(result.output).toBe('2')
      })

      it('handles negative exponent', async () => {
        const result = await render('{pow:2|-1}')
        expect(result.output).toBe('0.5')
      })
    })

    describe('modulo', () => {
      it('calculates remainder', async () => {
        const result = await render('{mod:10|3}')
        expect(result.output).toBe('1')
      })

      it('handles negative numbers', async () => {
        const result = await render('{mod:-10|3}')
        expect(['-1', '2']).toContain(result.output)
      })

      it('handles decimal numbers', async () => {
        const result = await render('{mod:10.5|3}')
        const value = parseFloat(result.output)
        expect(value).toBeCloseTo(1.5)
      })
    })

    describe('floor', () => {
      it('rounds down', async () => {
        expect((await render('{floor:5.9}')).output).toBe('5')
        expect((await render('{floor:-5.1}')).output).toBe('-6')
        expect((await render('{floor:3.1}')).output).toBe('3')
      })
    })

    describe('ceil', () => {
      it('rounds up', async () => {
        expect((await render('{ceil:5.1}')).output).toBe('6')
        expect((await render('{ceil:-5.9}')).output).toBe('-5')
        expect((await render('{ceil:3.9}')).output).toBe('4')
      })
    })

    describe('round', () => {
      it('rounds to nearest integer', async () => {
        expect((await render('{round:5.5}')).output).toBe('6')
        expect((await render('{round:5.4}')).output).toBe('5')
        expect((await render('{round:5.75}')).output).toBe('6')
      })
    })

    describe('base', () => {
      it('converts to different bases', async () => {
        expect((await render('{base:4|2}')).output).toBe('100')
        expect((await render('{base:255|16}')).output).toBe('ff')
        expect((await render('{base:10|10}')).output).toBe('10')
        expect((await render('{base:8|8}')).output).toBe('10')
      })

      it('handles invalid bases', async () => {
        expect((await render('{base:10|1}')).output).toBe(
          'Error: base must be between 2 and 36',
        )
        expect((await render('{base:10|37}')).output).toBe(
          'Error: base must be between 2 and 36',
        )
      })
    })

    describe('nested math', () => {
      it('handles nested arithmetic', async () => {
        const result = await render('{add:{multiply:2|3}|{subtract:10|4}}')
        expect(result.output).toBe('12')
      })

      it('handles complex nesting', async () => {
        const result = await render('{multiply:{add:2|3}|{pow:2|2}}')
        expect(result.output).toBe('20')
      })
    })
  })

  describe('Time tags', () => {
    describe('now', () => {
      it('returns current timestamp in UTC', async () => {
        const result = await render('{now}')
        const timestamp = parseInt(result.output, 10)
        const now = Date.now()
        expect(timestamp).toBeGreaterThanOrEqual(now - 1000)
        expect(timestamp).toBeLessThanOrEqual(now + 1000)
      })
    })

    describe('time', () => {
      it('formats timestamp with date-fns pattern', async () => {
        const result = await render('{time:d.M.yyyy}')
        expect(result.output).toMatch(/^\d{1,2}\.\d{1,2}\.\d{4}$/)
      })

      it('handles custom format patterns', async () => {
        const result = await render('{time:yyyy-MM-dd}')
        expect(result.output).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      })

      it('handles timestamp input', async () => {
        const result = await render('{time:1700000000000|d.M.yyyy}')
        expect(result.output).toBe('14.11.2023')
      })

      it('handles format only (uses current time)', async () => {
        const result = await render('{time:HH:mm:ss}')
        expect(result.output).toMatch(/^\d{2}:\d{2}:\d{2}$/)
      })

      it('handles missing format', async () => {
        const result = await render('{time}')
        const timestamp = parseInt(result.output, 10)
        const now = Date.now()
        expect(timestamp).toBeGreaterThanOrEqual(now - 1000)
        expect(timestamp).toBeLessThanOrEqual(now + 1000)
      })
    })
  })

  describe('Miscellaneous tags', () => {
    describe('uuid', () => {
      it('generates UUID with 8-4-4-4 pattern', async () => {
        const result = await render('{uuid}')
        expect(result.output).toMatch(
          /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
        )
      })

      it('generates unique UUIDs', async () => {
        const result1 = await render('{uuid}')
        const result2 = await render('{uuid}')
        expect(result1.output).not.toBe(result2.output)
      })
    })
  })
})
