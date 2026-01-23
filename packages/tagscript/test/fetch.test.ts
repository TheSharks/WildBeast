import { describe, expect, it } from 'vitest'
import { render } from '../src/index.js'

describe('fetch tag', () => {
  it('fetches content from a URL', async () => {
    const result = await render(
      '{fetch:https://jsonplaceholder.typicode.com/todos/1}',
      { enableFetch: true },
    )
    expect(result.output).toContain('"id": 1')
  })

  it('throws when fetch tag is disabled', async () => {
    await expect(
      render('{fetch:https://jsonplaceholder.typicode.com/todos/1}'),
    ).rejects.toThrow('Fetch tag is disabled in the current context')
  })

  it('allows up to maxFetchRequests', async () => {
    const result = await render(
      '{fetch:https://jsonplaceholder.typicode.com/todos/1} {fetch:https://jsonplaceholder.typicode.com/todos/2} {fetch:https://jsonplaceholder.typicode.com/todos/3}',
      { enableFetch: true, maxFetchRequests: 3 },
    )
    expect(result.output).toContain('"id": 1')
    expect(result.output).toContain('"id": 2')
    expect(result.output).toContain('"id": 3')
  })

  it('throws when exceeding maxFetchRequests', async () => {
    await expect(
      render(
        '{fetch:https://jsonplaceholder.typicode.com/todos/1} {fetch:https://jsonplaceholder.typicode.com/todos/2} {fetch:https://jsonplaceholder.typicode.com/todos/3} {fetch:https://jsonplaceholder.typicode.com/todos/4}',
        { enableFetch: true, maxFetchRequests: 3 },
      ),
    ).rejects.toThrow('Exceeded maximum fetch requests of 3')
  })

  it('supports custom HTTP methods', async () => {
    const result = await render(
      '{fetch:https://jsonplaceholder.typicode.com/posts|POST}',
      { enableFetch: true },
    )
    expect(result.output).toContain('"id": 101')
  })
})
