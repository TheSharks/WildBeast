import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from '../src/index.js'
import { RenderError } from '../src/runtime/errors.js'

function mockFetch(impl?: (url: string, init: RequestInit) => Response) {
  const fn = vi.fn(async (input: string | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input.toString()
    return (
      impl?.(url, init) ??
      new Response(JSON.stringify({ id: 1, url }), { status: 200 })
    )
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetch tag', () => {
  it('fetches content from a URL', async () => {
    mockFetch(() => new Response(JSON.stringify({ id: 1 }), { status: 200 }))
    const result = await render('{fetch:https://example.com/todos/1}', {
      enableFetch: true,
    })
    expect(result.output).toContain('"id":1')
  })

  it('sends the rendered HTTP method', async () => {
    const fn = mockFetch(() => new Response('ok', { status: 200 }))
    await render('{fetch:https://example.com/posts|POST}', {
      enableFetch: true,
    })
    expect(fn).toHaveBeenCalledOnce()
    expect(fn.mock.calls[0][1].method).toBe('POST')
  })

  it('defaults to GET', async () => {
    const fn = mockFetch(() => new Response('ok', { status: 200 }))
    await render('{fetch:https://example.com/todos/1}', { enableFetch: true })
    expect(fn.mock.calls[0][1].method).toBe('GET')
  })

  it('throws RenderError when fetch tag is disabled', async () => {
    await expect(render('{fetch:https://example.com/todos/1}')).rejects.toThrow(
      RenderError,
    )
    await expect(render('{fetch:https://example.com/todos/1}')).rejects.toThrow(
      'Fetch tag is disabled in the current context',
    )
  })

  it('allows up to maxFetchRequests', async () => {
    const fn = mockFetch((url) => new Response(url, { status: 200 }))
    const result = await render(
      '{fetch:https://example.com/1} {fetch:https://example.com/2} {fetch:https://example.com/3}',
      { enableFetch: true, maxFetchRequests: 3 },
    )
    expect(fn).toHaveBeenCalledTimes(3)
    expect(result.output).toContain('/1')
    expect(result.output).toContain('/2')
    expect(result.output).toContain('/3')
  })

  it('throws RenderError when exceeding maxFetchRequests', async () => {
    mockFetch(() => new Response('ok', { status: 200 }))
    await expect(
      render(
        '{fetch:https://example.com/1} {fetch:https://example.com/2} {fetch:https://example.com/3} {fetch:https://example.com/4}',
        { enableFetch: true, maxFetchRequests: 3 },
      ),
    ).rejects.toThrow('Exceeded maximum fetch requests of 3')
  })

  it('throws RenderError on a non-ok response', async () => {
    mockFetch(() => new Response('nope', { status: 500 }))
    await expect(
      render('{fetch:https://example.com/todos/1}', { enableFetch: true }),
    ).rejects.toThrow('Fetch request failed with status 500')
  })

  describe('URL validation', () => {
    it('throws on an invalid URL', async () => {
      mockFetch()
      await expect(
        render('{fetch:not a url}', { enableFetch: true }),
      ).rejects.toThrow('Invalid fetch URL')
    })

    it.each([
      'file:///etc/passwd',
      'ftp://example.com/file',
    ])('blocks the %s scheme', async (url) => {
      const fn = mockFetch()
      await expect(
        render(`{fetch:${url}}`, { enableFetch: true }),
      ).rejects.toThrow('Blocked fetch URL scheme')
      expect(fn).not.toHaveBeenCalled()
    })

    it.each([
      'http://127.0.0.1/',
      'http://169.254.169.254/latest/meta-data',
      'http://[::1]/',
      'http://[::ffff:127.0.0.1]/',
      'http://10.0.0.5/',
      'http://192.168.1.1/',
      'http://172.16.5.4/',
    ])('blocks the private target %s', async (url) => {
      const fn = mockFetch()
      await expect(
        render(`{fetch:${url}}`, { enableFetch: true }),
      ).rejects.toThrow(/Blocked fetch to private address/)
      expect(fn).not.toHaveBeenCalled()
    })

    it.each([
      'http://localhost/',
      'http://api.localhost/',
    ])('blocks the localhost name %s', async (url) => {
      const fn = mockFetch()
      await expect(
        render(`{fetch:${url}}`, { enableFetch: true }),
      ).rejects.toThrow('Blocked fetch to private host')
      expect(fn).not.toHaveBeenCalled()
    })

    it('allows public addresses', async () => {
      const fn = mockFetch(() => new Response('ok', { status: 200 }))
      const result = await render('{fetch:https://example.com/data}', {
        enableFetch: true,
      })
      expect(result.output).toBe('ok')
      expect(fn).toHaveBeenCalledOnce()
    })
  })

  describe('fetchAllowedHosts', () => {
    it('allows a host on the allowlist', async () => {
      const fn = mockFetch(() => new Response('ok', { status: 200 }))
      const result = await render('{fetch:https://api.example.com/data}', {
        enableFetch: true,
        fetchAllowedHosts: ['api.example.com'],
      })
      expect(result.output).toBe('ok')
      expect(fn).toHaveBeenCalledOnce()
    })

    it('matches the allowlist case-insensitively', async () => {
      mockFetch(() => new Response('ok', { status: 200 }))
      const result = await render('{fetch:https://API.Example.com/data}', {
        enableFetch: true,
        fetchAllowedHosts: ['api.example.com'],
      })
      expect(result.output).toBe('ok')
    })

    it('rejects a host not on the allowlist', async () => {
      const fn = mockFetch()
      await expect(
        render('{fetch:https://evil.example.org/data}', {
          enableFetch: true,
          fetchAllowedHosts: ['api.example.com'],
        }),
      ).rejects.toThrow('Fetch host not in allowlist')
      expect(fn).not.toHaveBeenCalled()
    })
  })

  describe('response size cap', () => {
    it('aborts an oversized body', async () => {
      const fn = mockFetch(() => new Response('x'.repeat(500), { status: 200 }))
      await expect(
        render('{fetch:https://example.com/big}', {
          enableFetch: true,
          maxOutputLength: 50,
        }),
      ).rejects.toThrow('Fetch response exceeded maximum length')
      expect(fn).toHaveBeenCalledOnce()
    })
  })

  describe('fetchOptions', () => {
    it('lets the embedder override the method but keeps the default User-Agent', async () => {
      const fn = mockFetch(() => new Response('ok', { status: 200 }))
      await render('{fetch:https://example.com/data|POST}', {
        enableFetch: true,
        fetchOptions: { method: 'PUT', headers: { 'X-Token': 'secret' } },
      })
      const init = fn.mock.calls[0][1]
      expect(init.method).toBe('PUT')
      const headers = init.headers as Record<string, string>
      expect(headers['X-Token']).toBe('secret')
      expect(headers['User-Agent']).toContain('TagScript')
    })

    it('passes an abort signal by default', async () => {
      const fn = mockFetch(() => new Response('ok', { status: 200 }))
      await render('{fetch:https://example.com/data}', { enableFetch: true })
      expect(fn.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
    })
  })
})
